import { randomUUID } from 'node:crypto';

import { database } from './database.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';

export const SHIPPING_FEE = 3_500;
export const FREE_SHIPPING_THRESHOLD = 100_000;
export const ORDER_PAGE_SIZE = 20;

export const ORDER_STATUS = Object.freeze({
  payment_pending: { label: '결제 대기', customerAction: 'request_cancel' },
  confirmed: { label: '주문 확인', customerAction: 'request_cancel' },
  preparing: { label: '배송 준비', customerAction: 'request_cancel' },
  shipped: { label: '배송 중', customerAction: 'request_refund' },
  delivered: { label: '배송 완료', customerAction: 'request_refund' },
  cancel_requested: { label: '취소 요청', customerAction: '' },
  cancelled: { label: '취소 완료', customerAction: '' },
  refund_requested: { label: '반품·환불 요청', customerAction: '' },
  refunded: { label: '환불 완료', customerAction: '' },
});

const ADMIN_TRANSITIONS = Object.freeze({
  payment_pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refund_requested'],
  delivered: ['refund_requested'],
  cancel_requested: ['confirmed', 'preparing', 'cancelled'],
  cancelled: [],
  refund_requested: ['delivered', 'refunded'],
  refunded: [],
});

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,19}$/;
const MAX_ITEMS = 30;
const MAX_QUANTITY = 99;
let schemaPromise;

function cleanLine(value, maximum = 500) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function cleanNote(value, maximum = 1_000) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maximum);
}

function iso(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function orderNumber(id, now = new Date()) {
  const date = now.toISOString().slice(2, 10).replaceAll('-', '');
  return `HMW-${date}-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

export function calculateOrderTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal, shippingFee, total: subtotal + shippingFee };
}

export function validateOrderFields(input) {
  const value = {
    requestId: cleanLine(input?.requestId, 80),
    recipientName: cleanLine(input?.recipientName, 50),
    email: cleanLine(input?.email, 254).toLowerCase(),
    phone: cleanLine(input?.phone, 24),
    postalCode: cleanLine(input?.postalCode, 12),
    addressLine1: cleanLine(input?.addressLine1, 200),
    addressLine2: cleanLine(input?.addressLine2, 200),
    deliveryNote: cleanLine(input?.deliveryNote, 200),
    termsConsent: input?.termsConsent === true,
    privacyConsent: input?.privacyConsent === true,
  };
  const fieldErrors = {};

  if (!REQUEST_ID_PATTERN.test(value.requestId)) fieldErrors.form = '주문서를 새로고침한 뒤 다시 시도해 주세요.';
  if (value.recipientName.length < 2) fieldErrors.recipientName = '받는 분 이름을 2자 이상 입력해 주세요.';
  if (!EMAIL_PATTERN.test(value.email)) fieldErrors.email = '주문 안내를 받을 이메일 주소를 확인해 주세요.';
  if (!PHONE_PATTERN.test(value.phone)) fieldErrors.phone = '연락 가능한 전화번호를 숫자와 하이픈으로 입력해 주세요.';
  if (value.postalCode.length < 3) fieldErrors.postalCode = '우편번호를 입력해 주세요.';
  if (value.addressLine1.length < 5) fieldErrors.addressLine1 = '배송받을 기본 주소를 입력해 주세요.';
  if (!value.termsConsent) fieldErrors.termsConsent = '주문하려면 이용약관에 동의해 주세요.';
  if (!value.privacyConsent) fieldErrors.privacyConsent = '주문 배송정보 수집·이용에 동의해 주세요.';

  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function validateOrderItems(input) {
  const fieldErrors = {};
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_ITEMS) {
    return { items: [], fieldErrors: { items: '주문할 상품을 1개 이상 확인해 주세요.' }, valid: false };
  }

  const seen = new Set();
  const items = [];
  for (const item of input) {
    const productId = cleanLine(item?.productId, 120);
    const quantity = Number(item?.quantity);
    if (!productId || seen.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      fieldErrors.items = '상품과 수량을 다시 확인해 주세요.';
      break;
    }
    seen.add(productId);
    items.push({ productId, quantity });
  }
  return { items, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function allowedAdminTransitions(status, requestFromStatus = '') {
  if (status === 'cancel_requested' && ['payment_pending', 'confirmed', 'preparing'].includes(requestFromStatus)) {
    return [requestFromStatus, 'cancelled'];
  }
  if (status === 'refund_requested' && ['shipped', 'delivered'].includes(requestFromStatus)) {
    return [requestFromStatus, 'refunded'];
  }
  return [...(ADMIN_TRANSITIONS[status] || [])];
}

export function customerOrderAction(status) {
  return ORDER_STATUS[status]?.customerAction || '';
}

export async function ensureOrderSchema() {
  if (!schemaPromise) {
    const sql = database();
    schemaPromise = sql.transaction((tx) => [
      tx`CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY,
        order_number text NOT NULL UNIQUE,
        request_id text NOT NULL UNIQUE,
        user_id text REFERENCES users(id) ON DELETE SET NULL,
        member_email text,
        recipient_name text NOT NULL,
        email text NOT NULL,
        phone text NOT NULL,
        postal_code text NOT NULL,
        address_line1 text NOT NULL,
        address_line2 text,
        delivery_note text,
        subtotal integer NOT NULL CHECK (subtotal >= 0),
        shipping_fee integer NOT NULL CHECK (shipping_fee >= 0),
        total integer NOT NULL CHECK (total >= 0),
        payment_method text NOT NULL DEFAULT 'provider_pending',
        status text NOT NULL DEFAULT 'payment_pending' CHECK (status IN (
          'payment_pending', 'confirmed', 'preparing', 'shipped', 'delivered',
          'cancel_requested', 'cancelled', 'refund_requested', 'refunded'
        )),
        carrier text NOT NULL DEFAULT '로젠택배',
        tracking_number text,
        revision integer NOT NULL DEFAULT 1,
        terms_agreed_at timestamptz NOT NULL,
        privacy_agreed_at timestamptz NOT NULL,
        retention_until timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      tx`CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC)`,
      tx`CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC)`,
      tx`CREATE INDEX IF NOT EXISTS orders_retention_idx ON orders(retention_until)`,
      tx`CREATE TABLE IF NOT EXISTS order_items (
        id text PRIMARY KEY,
        order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id text NOT NULL,
        product_name text NOT NULL,
        product_model text NOT NULL,
        unit_price integer NOT NULL CHECK (unit_price >= 0),
        quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
        line_total integer NOT NULL CHECK (line_total >= 0),
        image_url text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      tx`CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id, created_at)`,
      tx`CREATE TABLE IF NOT EXISTS order_events (
        id text PRIMARY KEY,
        order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        actor text NOT NULL CHECK (actor IN ('member', 'admin', 'system')),
        from_status text,
        to_status text NOT NULL,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      tx`CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at)`,
    ]).then(() => sql.query('DELETE FROM orders WHERE retention_until <= now()')).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function currentCatalog() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return catalog.products.map(publicProduct);
}

function mapOrderRow(row, items = [], events = [], includeAdminNotes = false) {
  const status = ORDER_STATUS[row.status] ? row.status : 'payment_pending';
  const requestFromStatus = events.at(-1)?.from_status || '';
  return {
    orderNumber: row.order_number,
    status,
    statusLabel: ORDER_STATUS[status].label,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    total: Number(row.total),
    recipient: {
      name: row.recipient_name,
      email: row.email,
      phone: row.phone,
      postalCode: row.postal_code,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2 || '',
      deliveryNote: row.delivery_note || '',
    },
    delivery: { carrier: row.carrier, trackingNumber: row.tracking_number || '' },
    items: items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      model: item.product_model,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.line_total),
      image: item.image_url || '',
    })),
    events: events.map((event) => ({
      actor: event.actor,
      fromStatus: event.from_status || '',
      toStatus: event.to_status,
      statusLabel: ORDER_STATUS[event.to_status]?.label || event.to_status,
      note: event.actor === 'admin' && !includeAdminNotes ? '' : (event.note || ''),
      createdAt: iso(event.created_at),
    })),
    customerAction: customerOrderAction(status),
    allowedTransitions: allowedAdminTransitions(status, requestFromStatus),
    revision: Number(row.revision),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function hydrateOrders(rows, includeAdminNotes = false) {
  if (!rows.length) return [];
  const sql = database();
  const ids = rows.map((row) => row.id);
  const [items, events] = await Promise.all([
    sql.query('SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY created_at, id', [ids]),
    sql.query('SELECT * FROM order_events WHERE order_id = ANY($1::text[]) ORDER BY created_at, id', [ids]),
  ]);
  const itemMap = new Map(ids.map((id) => [id, []]));
  const eventMap = new Map(ids.map((id) => [id, []]));
  items.forEach((item) => itemMap.get(item.order_id)?.push(item));
  events.forEach((event) => eventMap.get(event.order_id)?.push(event));
  return rows.map((row) => mapOrderRow(row, itemMap.get(row.id), eventMap.get(row.id), includeAdminNotes));
}

async function readExistingOrder(userId, requestId) {
  const rows = await database().query(
    'SELECT * FROM orders WHERE user_id = $1 AND request_id = $2 LIMIT 1',
    [userId, requestId],
  );
  return (await hydrateOrders(rows))[0] || null;
}

export async function createOrder(user, input) {
  await ensureOrderSchema();
  const fields = validateOrderFields(input);
  const itemInput = validateOrderItems(input?.items);
  const fieldErrors = { ...fields.fieldErrors, ...itemInput.fieldErrors };
  if (Object.keys(fieldErrors).length) {
    throw Object.assign(new Error('주문서 내용을 확인해 주세요.'), { status: 400, fieldErrors });
  }

  const existing = await readExistingOrder(user.id, fields.value.requestId);
  if (existing) return { order: existing, duplicate: true };

  const catalog = await currentCatalog();
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const items = itemInput.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !Number.isInteger(product.price) || product.price < 1) {
      throw Object.assign(new Error('현재 주문할 수 없는 상품이 포함되어 있습니다.'), {
        status: 409,
        fieldErrors: { items: '상품 정보를 새로 불러온 뒤 다시 주문해 주세요.' },
      });
    }
    return {
      productId: product.id,
      name: product.name,
      model: product.model,
      image: product.image,
      unitPrice: product.price,
      quantity: item.quantity,
    };
  });
  const totals = calculateOrderTotals(items);
  if (totals.total > 30_000_000) {
    throw Object.assign(new Error('한 번에 주문할 수 있는 금액을 초과했습니다.'), { status: 400 });
  }

  const sql = database();
  const id = randomUUID();
  const number = orderNumber(id);
  const now = new Date();
  const retentionUntil = new Date(now);
  retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + 5);
  const queries = [
    sql`INSERT INTO orders (
      id, order_number, request_id, user_id, member_email, recipient_name, email, phone,
      postal_code, address_line1, address_line2, delivery_note, subtotal, shipping_fee, total,
      terms_agreed_at, privacy_agreed_at, retention_until
    ) VALUES (
      ${id}, ${number}, ${fields.value.requestId}, ${user.id}, ${user.email || null},
      ${fields.value.recipientName}, ${fields.value.email}, ${fields.value.phone},
      ${fields.value.postalCode}, ${fields.value.addressLine1}, ${fields.value.addressLine2 || null},
      ${fields.value.deliveryNote || null}, ${totals.subtotal}, ${totals.shippingFee}, ${totals.total},
      ${now.toISOString()}, ${now.toISOString()}, ${retentionUntil.toISOString()}
    )`,
    ...items.map((item) => sql`INSERT INTO order_items (
      id, order_id, product_id, product_name, product_model, unit_price, quantity, line_total, image_url
    ) VALUES (
      ${randomUUID()}, ${id}, ${item.productId}, ${item.name}, ${item.model}, ${item.unitPrice},
      ${item.quantity}, ${item.unitPrice * item.quantity}, ${item.image || null}
    )`),
    sql`INSERT INTO order_events (id, order_id, actor, from_status, to_status, note)
      VALUES (${randomUUID()}, ${id}, 'member', ${null}, 'payment_pending', 'PG 결제 연결 전 주문 접수')`,
  ];

  try {
    await sql.transaction(queries);
  } catch (error) {
    if (error?.code === '23505') {
      const duplicate = await readExistingOrder(user.id, fields.value.requestId);
      if (duplicate) return { order: duplicate, duplicate: true };
    }
    throw error;
  }
  return { order: await readOrderForMember(user.id, number), duplicate: false };
}

export async function readOrderForMember(userId, number) {
  await ensureOrderSchema();
  const rows = await database().query(
    'SELECT * FROM orders WHERE user_id = $1 AND order_number = $2 LIMIT 1',
    [userId, cleanLine(number, 80)],
  );
  return (await hydrateOrders(rows))[0] || null;
}

export async function listMemberOrders(userId, page = 1) {
  await ensureOrderSchema();
  const safePage = Math.max(1, Math.min(500, Number(page) || 1));
  const offset = (safePage - 1) * ORDER_PAGE_SIZE;
  const sql = database();
  const [countRows, rows] = await Promise.all([
    sql.query('SELECT COUNT(*)::integer AS count FROM orders WHERE user_id = $1', [userId]),
    sql.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, ORDER_PAGE_SIZE, offset]),
  ]);
  const total = Number(countRows[0]?.count || 0);
  return { items: await hydrateOrders(rows), page: safePage, pageSize: ORDER_PAGE_SIZE, total, hasMore: offset + rows.length < total };
}

export async function requestOrderChange(userId, input) {
  await ensureOrderSchema();
  const number = cleanLine(input?.orderNumber, 80);
  const action = cleanLine(input?.action, 40);
  const expectedRevision = Number(input?.revision);
  if (!number || !Number.isInteger(expectedRevision) || !['request_cancel', 'request_refund'].includes(action)) {
    throw Object.assign(new Error('주문 요청 내용을 확인해 주세요.'), { status: 400 });
  }
  const order = await readOrderForMember(userId, number);
  if (!order) throw Object.assign(new Error('주문을 찾을 수 없습니다.'), { status: 404 });
  if (order.revision !== expectedRevision) throw Object.assign(new Error('주문 상태가 변경되었습니다. 주문 내역을 새로고침해 주세요.'), { status: 409 });
  if (order.customerAction !== action) throw Object.assign(new Error('현재 주문 단계에서는 이 요청을 접수할 수 없습니다.'), { status: 409 });

  const target = action === 'request_cancel' ? 'cancel_requested' : 'refund_requested';
  const note = action === 'request_cancel' ? '고객이 주문 취소를 요청했습니다.' : '고객이 반품·환불을 요청했습니다.';
  const eventId = randomUUID();
  const rows = await database().query(
    `WITH changed AS (
       UPDATE orders SET status = $1, revision = revision + 1, updated_at = now()
        WHERE order_number = $2 AND user_id = $3 AND revision = $4 AND status = $5
        RETURNING id
     )
     INSERT INTO order_events (id, order_id, actor, from_status, to_status, note)
     SELECT $6, id, 'member', $5, $1, $7 FROM changed
     RETURNING order_id`,
    [target, number, userId, expectedRevision, order.status, eventId, note],
  );
  if (!rows[0]) throw Object.assign(new Error('주문 상태가 변경되었습니다. 주문 내역을 새로고침해 주세요.'), { status: 409 });
  return readOrderForMember(userId, number);
}

export async function listAdminOrders({ page = 1, status = '' } = {}) {
  await ensureOrderSchema();
  const safePage = Math.max(1, Math.min(10_000, Number(page) || 1));
  const safeStatus = cleanLine(status, 40);
  if (safeStatus && !ORDER_STATUS[safeStatus]) throw Object.assign(new Error('주문 상태 필터를 확인해 주세요.'), { status: 400 });
  const offset = (safePage - 1) * ORDER_PAGE_SIZE;
  const sql = database();
  const parameters = safeStatus ? [safeStatus] : [];
  const where = safeStatus ? ' WHERE status = $1' : '';
  const limitIndex = parameters.length + 1;
  const offsetIndex = parameters.length + 2;
  const [countRows, rows] = await Promise.all([
    sql.query(`SELECT COUNT(*)::integer AS count FROM orders${where}`, parameters),
    sql.query(
      `SELECT * FROM orders${where} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...parameters, ORDER_PAGE_SIZE, offset],
    ),
  ]);
  const total = Number(countRows[0]?.count || 0);
  return { items: await hydrateOrders(rows, true), page: safePage, pageSize: ORDER_PAGE_SIZE, total, pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)) };
}

export async function updateOrderByAdmin(input) {
  await ensureOrderSchema();
  const number = cleanLine(input?.orderNumber, 80);
  const targetStatus = cleanLine(input?.status, 40);
  const trackingNumber = cleanLine(input?.trackingNumber, 50);
  const note = cleanNote(input?.note, 1_000);
  const expectedRevision = Number(input?.revision);
  if (!number || !ORDER_STATUS[targetStatus] || !Number.isInteger(expectedRevision)) {
    throw Object.assign(new Error('주문 변경 내용을 확인해 주세요.'), { status: 400 });
  }
  const rows = await database().query(
    `SELECT orders.*,
            (SELECT from_status FROM order_events WHERE order_id = orders.id ORDER BY created_at DESC, id DESC LIMIT 1) AS request_from_status
       FROM orders
      WHERE order_number = $1
      LIMIT 1`,
    [number],
  );
  const current = rows[0];
  if (!current) throw Object.assign(new Error('주문을 찾을 수 없습니다.'), { status: 404 });
  if (Number(current.revision) !== expectedRevision) throw Object.assign(new Error('다른 화면에서 주문이 변경되었습니다. 목록을 새로고침해 주세요.'), { status: 409 });
  const statusChanged = current.status !== targetStatus;
  if (statusChanged && !allowedAdminTransitions(current.status, current.request_from_status || '').includes(targetStatus)) {
    throw Object.assign(new Error('현재 단계에서 선택할 수 없는 주문 상태입니다.'), { status: 409 });
  }
  if (targetStatus === 'shipped' && trackingNumber.length < 5) {
    throw Object.assign(new Error('배송 중으로 변경하려면 운송장 번호를 입력해 주세요.'), { status: 400, fieldErrors: { trackingNumber: '운송장 번호를 입력해 주세요.' } });
  }
  if (!statusChanged && trackingNumber === (current.tracking_number || '') && !note) {
    throw Object.assign(new Error('변경할 상태, 운송장 번호 또는 관리자 메모를 입력해 주세요.'), { status: 400 });
  }

  const eventNote = note || (statusChanged ? `관리자가 주문 상태를 ${ORDER_STATUS[targetStatus].label}(으)로 변경했습니다.` : '관리자가 배송 정보를 변경했습니다.');
  const eventId = randomUUID();
  const changed = await database().query(
    `WITH updated AS (
       UPDATE orders
          SET status = $1, tracking_number = $2, revision = revision + 1, updated_at = now()
        WHERE order_number = $3 AND revision = $4 AND status = $5
        RETURNING id
     )
     INSERT INTO order_events (id, order_id, actor, from_status, to_status, note)
     SELECT $6, id, 'admin', $5, $1, $7 FROM updated
     RETURNING order_id`,
    [targetStatus, trackingNumber || null, number, expectedRevision, current.status, eventId, eventNote],
  );
  if (!changed[0]) throw Object.assign(new Error('주문 상태가 변경되었습니다. 목록을 새로고침해 주세요.'), { status: 409 });
  const updated = await database().query('SELECT * FROM orders WHERE order_number = $1 LIMIT 1', [number]);
  return (await hydrateOrders(updated, true))[0];
}
