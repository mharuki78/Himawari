import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

import { database } from './database.js';
import { ensureOrderSchema } from './orders.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';
import { applyInventoryReservations } from './inventory.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let schemaPromise;

function line(value, maximum = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function paragraph(value, maximum = 2_000) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function html(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function validImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function ensureCustomerFeatureSchema() {
  if (!schemaPromise) {
    const sql = database();
    schemaPromise = ensureOrderSchema().then(() => sql.transaction((tx) => [
      tx`CREATE TABLE IF NOT EXISTS product_reviews (
        id text PRIMARY KEY,
        product_id text NOT NULL,
        order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        reviewer_name text NOT NULL,
        rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title text,
        content text NOT NULL,
        media_url text,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
        verified boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(order_id, product_id)
      )`,
      tx`CREATE INDEX IF NOT EXISTS product_reviews_public_idx ON product_reviews(product_id, status, created_at DESC)`,
      tx`ALTER TABLE product_reviews ALTER COLUMN order_id DROP NOT NULL`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'himawari'`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS source_review_id text`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS source_url text`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS source_product_name text`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS review_group_key text`,
      tx`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb`,
      tx`CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_source_idx ON product_reviews(source, source_review_id) WHERE source_review_id IS NOT NULL`,
      tx`CREATE TABLE IF NOT EXISTS restock_subscriptions (
        id text PRIMARY KEY,
        product_id text NOT NULL,
        option_id text NOT NULL DEFAULT '',
        email text NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'unsubscribed')),
        unsubscribe_hash text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(product_id, option_id, email)
      )`,
      tx`CREATE INDEX IF NOT EXISTS restock_subscriptions_active_idx ON restock_subscriptions(product_id, option_id, status)`,
    ])).catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

export async function listPublishedReviews(productId, offset = 0, nativeOnly = false, requestedGroup = '') {
  await ensureCustomerFeatureSchema();
  const safeId = line(productId, 120);
  const pageOffset = Math.max(0, Math.min(1_000_000, Math.trunc(Number(offset) || 0)));
  const groupKey = !nativeOnly && /^[A-Z0-9-]{1,30}$/.test(requestedGroup) ? requestedGroup : '';
  const predicate = `status = 'published' ${nativeOnly ? "AND source = 'himawari'" : ''} AND ($1 = '' OR product_id = $1 OR (source = 'naver' AND $2 <> '' AND review_group_key = $2))`;
  const rows = await database().query(
    `SELECT id, reviewer_name, rating, title, content, media_url, verified, created_at, source, source_url, source_product_name, media_urls
       FROM product_reviews WHERE ${predicate}
      ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET $3`,
    [safeId, groupKey, pageOffset],
  );
  const reviews = rows.map((row) => ({ id: row.id, reviewerName: row.reviewer_name, rating: Number(row.rating), title: row.title || '', content: row.content, mediaUrl: row.media_url || '', mediaUrls: row.media_urls || [], sourceProductName: row.source_product_name || '', verified: row.source === 'himawari' && row.verified === true, source: row.source, sourceUrl: row.source_url || '', createdAt: new Date(row.created_at).toISOString() }));
  const [aggregate] = await database().query(
    `SELECT count(*) AS count, coalesce(round(avg(rating), 1), 0) AS rating_value,
      count(*) FILTER (WHERE source = 'naver') AS naver_count
      FROM product_reviews WHERE ${predicate}`, [safeId, groupKey],
  );
  return { reviews, nextOffset: pageOffset + reviews.length < Number(aggregate.count) ? pageOffset + reviews.length : null, aggregate: { count: Number(aggregate.count), ratingValue: Number(aggregate.rating_value), naverCount: Number(aggregate.naver_count) } };
}

async function verifiedOrder(productId, orderNumber, email) {
  const rows = await database().query(
    `SELECT o.id, o.recipient_name
       FROM orders o JOIN order_items i ON i.order_id = o.id
      WHERE o.order_number = $1 AND lower(o.email) = lower($2) AND o.status = 'delivered' AND i.product_id = $3
      LIMIT 1`,
    [orderNumber, email, productId],
  );
  return rows[0] || null;
}

export async function createVerifiedReview(form) {
  await ensureCustomerFeatureSchema();
  const productId = line(form.get('productId'), 120);
  const orderNumber = line(form.get('orderNumber'), 80);
  const email = line(form.get('email'), 254).toLowerCase();
  const rating = Number(form.get('rating'));
  const title = line(form.get('title'), 100);
  const content = paragraph(form.get('content'), 2_000);
  const consent = form.get('consent') === 'true';
  if (!productId || !orderNumber || !EMAIL_PATTERN.test(email) || !Number.isInteger(rating) || rating < 1 || rating > 5 || content.length < 10 || !consent) {
    throw Object.assign(new Error('주문정보, 평점, 10자 이상의 리뷰와 공개 동의를 확인해 주세요.'), { status: 400 });
  }
  const order = await verifiedOrder(productId, orderNumber, email);
  if (!order) throw Object.assign(new Error('배송 완료된 주문 정보를 확인할 수 없습니다.'), { status: 403 });

  let mediaUrl = '';
  const image = form.get('image');
  if (image && typeof image === 'object' && Number(image.size) > 0) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 2_000_000 || !(await validImageSignature(image))) {
      throw Object.assign(new Error('리뷰 사진은 JPG, PNG, WebP 형식의 2MB 이하 파일만 가능합니다.'), { status: 400 });
    }
    if (!process.env.PRODUCT_BLOB_READ_WRITE_TOKEN && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw Object.assign(new Error('사진 저장소가 준비되지 않았습니다. 사진 없이 등록해 주세요.'), { status: 503 });
    }
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.type];
    const result = await put(`reviews/${productId}/${randomUUID()}.${extension}`, image, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.PRODUCT_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN,
      contentType: image.type,
    });
    mediaUrl = result.url;
  }

  try {
    await database().query(
      `INSERT INTO product_reviews (id, product_id, order_id, reviewer_name, rating, title, content, media_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), productId, order.id, line(order.recipient_name, 1).concat('**'), rating, title || null, content, mediaUrl || null],
    );
  } catch (error) {
    if (error?.code === '23505') throw Object.assign(new Error('이 주문의 해당 제품 리뷰는 이미 등록되었습니다.'), { status: 409 });
    throw error;
  }
  return { message: '리뷰가 등록되었습니다. 확인 후 공개하겠습니다.' };
}

export async function subscribeRestock(input) {
  await ensureCustomerFeatureSchema();
  const productId = line(input?.productId, 120);
  const optionId = line(input?.optionId, 120);
  const email = line(input?.email, 254).toLowerCase();
  if (!productId || !EMAIL_PATTERN.test(email) || input?.consent !== true) throw Object.assign(new Error('이메일과 알림 동의를 확인해 주세요.'), { status: 400 });
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  const products = await applyInventoryReservations(catalog.products.map(publicProduct));
  const product = products.find((item) => item.id === productId);
  const option = optionId ? product?.options?.find((item) => item.id === optionId) : null;
  if (!product || (optionId && !option)) throw Object.assign(new Error('알림을 신청할 제품이나 옵션을 찾을 수 없습니다.'), { status: 404 });
  if (option ? option.stock > 0 : !product.soldOut) throw Object.assign(new Error('현재 주문 가능한 상품입니다.'), { status: 409 });
  const token = randomBytes(24).toString('base64url');
  await database().query(
    `INSERT INTO restock_subscriptions (id, product_id, option_id, email, unsubscribe_hash)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (product_id, option_id, email) DO UPDATE SET status='active', unsubscribe_hash=EXCLUDED.unsubscribe_hash, updated_at=now()`,
    [randomUUID(), productId, optionId, email, tokenHash(token)],
  );
  return { message: '재입고 알림을 신청했습니다.', unsubscribeToken: token };
}

export async function unsubscribeRestock(token) {
  await ensureCustomerFeatureSchema();
  const rows = await database().query(
    `UPDATE restock_subscriptions SET status='unsubscribed', updated_at=now() WHERE unsubscribe_hash=$1 RETURNING id`,
    [tokenHash(token)],
  );
  if (!rows[0]) throw Object.assign(new Error('유효한 알림 해지 요청이 아닙니다.'), { status: 404 });
  return { message: '재입고 알림을 해지했습니다.' };
}

export async function listAdminReviews(status = '') {
  await ensureCustomerFeatureSchema();
  const safeStatus = ['pending', 'published', 'rejected'].includes(status) ? status : '';
  const rows = await database().query(`SELECT * FROM product_reviews${safeStatus ? ' WHERE status=$1' : ''} ORDER BY created_at DESC LIMIT 1000`, safeStatus ? [safeStatus] : []);
  const restock = await database().query(`SELECT product_id, option_id, COUNT(*)::integer AS count FROM restock_subscriptions WHERE status='active' GROUP BY product_id, option_id ORDER BY count DESC`);
  return { reviews: rows.map((row) => ({ id: row.id, productId: row.product_id, source: row.source, sourceProductName: row.source_product_name || '', reviewerName: row.reviewer_name, rating: Number(row.rating), title: row.title || '', content: row.content, mediaUrl: row.media_url || row.media_urls?.[0] || '', status: row.status, createdAt: new Date(row.created_at).toISOString() })), restock: restock.map((row) => ({ productId: row.product_id, optionId: row.option_id, count: Number(row.count) })) };
}

export async function moderateReview(input) {
  await ensureCustomerFeatureSchema();
  const id = line(input?.id, 80);
  const status = line(input?.status, 20);
  if (!id || !['published', 'rejected'].includes(status)) throw Object.assign(new Error('리뷰 처리 내용을 확인해 주세요.'), { status: 400 });
  const rows = await database().query('UPDATE product_reviews SET status=$1, updated_at=now() WHERE id=$2 RETURNING id', [status, id]);
  if (!rows[0]) throw Object.assign(new Error('리뷰를 찾을 수 없습니다.'), { status: 404 });
  return { message: status === 'published' ? '리뷰를 공개했습니다.' : '리뷰를 비공개 처리했습니다.' };
}

export async function notifyRestockSubscribers(product) {
  if (!process.env.RESEND_API_KEY || !process.env.RESTOCK_FROM_EMAIL || !product?.id) return { sent: 0, configured: false };
  await ensureCustomerFeatureSchema();
  const subscriptions = await database().query(`SELECT id,email,option_id FROM restock_subscriptions WHERE product_id=$1 AND status='active'`, [product.id]);
  const available = subscriptions.filter((subscription) => {
    if (!subscription.option_id) return product.soldOut !== true;
    return Number(product.options?.find((option) => option.id === subscription.option_id)?.stock || 0) > 0;
  });
  let sent = 0;
  for (const subscription of available) {
    const unsubscribeToken = randomBytes(24).toString('base64url');
    await database().query(`UPDATE restock_subscriptions SET unsubscribe_hash=$1,updated_at=now() WHERE id=$2 AND status='active'`, [tokenHash(unsubscribeToken), subscription.id]);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESTOCK_FROM_EMAIL,
        to: [subscription.email],
        subject: `[Himawari] ${product.model} 재입고 안내`,
        html: `<p>기다리신 <strong>${html(line(product.name, 200))}</strong> 상품이 다시 주문 가능합니다.</p><p><a href="https://himawari.co.kr/product.html?id=${encodeURIComponent(product.id)}">제품 확인하기</a></p><p><a href="https://himawari.co.kr/api/restock?token=${encodeURIComponent(unsubscribeToken)}">재입고 알림 해지</a></p>`,
      }),
    });
    if (!response.ok) continue;
    await database().query(`UPDATE restock_subscriptions SET status='notified',updated_at=now() WHERE id=$1 AND status='active'`, [subscription.id]);
    sent += 1;
  }
  return { sent, configured: true };
}
