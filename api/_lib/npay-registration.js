import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { database } from './database.js';
import { ensureNpayReservationSchema } from './inventory-reservation-store.js';
import { claimNpayRegistration, readReservedNpayProducts, recordNpayRegistrationOutcome, reserveNpayCheckout } from './npay-reservations.js';
import { buildOrderXml, naverOrderResult } from './npay.js';
import { INVENTORY_LOCK } from './black-friday.js';

let schemaPromise;
const failure = (status, message) => Object.assign(new Error(message), { status });
const conflict = () => failure(409, '네이버페이 주문 처리 상태를 확인하고 있습니다. 중복 주문을 방지하기 위해 다시 등록하지 않습니다.');

export async function ensureNpayRegistrationSchema() {
  if (!schemaPromise) schemaPromise = ensureNpayReservationSchema().then(() => database()`CREATE TABLE IF NOT EXISTS npay_registration_results (
    checkout_id text PRIMARY KEY REFERENCES npay_checkouts(id),
    ciphertext text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`).catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function encryptionKey(secret) {
  if (typeof secret !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(secret)) throw failure(503, '네이버페이 보안 저장 설정을 확인하고 있습니다.');
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32 || key.toString('base64') !== secret) throw failure(503, '네이버페이 보안 저장 설정을 확인하고 있습니다.');
  return key;
}

function encrypt(result, id, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(id));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(result)), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(v => v.toString('base64')).join('.');
}

function decrypt(value, id, key) {
  try {
    const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64'));
    const cipher = createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(tag);
    const result = JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString());
    if (!naverOrderResult(`SUCCESS:${result.key}:${result.merchantNo}`).ok) throw new Error();
    return { key: result.key, merchantNo: result.merchantNo };
  } catch { throw failure(503, '네이버페이 주문 복구 설정을 확인하고 있습니다.'); }
}

// Exactly one network registration per durable request. A lost response keeps
// its allocation held; neither a retry nor an empty poll creates another key.
export async function registerReservedNpayCheckout(input, {
  config, backUrl, naverInflowCode = '', saClickId = '',
  keySecret = process.env.NPAY_RESERVATION_ENCRYPTION_KEY,
  request = globalThis.fetch,
} = {}) {
  const key = encryptionKey(keySecret);
  if (!config?.shopId || !config.certiKey || ![
    'https://test-api.pay.naver.com/o/customer/api/order/v20/register',
    'https://api.pay.naver.com/o/customer/api/order/v20/register',
  ].includes(config.orderRegistrationUrl)) throw failure(503, '네이버페이 주문 연결 설정을 확인하고 있습니다.');
  await ensureNpayRegistrationSchema();
  const environment = config.orderRegistrationUrl.startsWith('https://test-') ? 'sandbox' : 'production';
  const { checkout, items } = await reserveNpayCheckout({...input,environment});
  const products = await readReservedNpayProducts(items.map(item => item.id));
  if (products.length !== items.length || products.some(p => p.npaySaleStatus !== 'ON_SALE')) throw failure(409, '상품 가격·재고 또는 행사 상태가 바뀌었습니다. 상품을 다시 확인해 주세요.');
  if (checkout.phase === 'registered') {
    const [stored] = await database()`SELECT ciphertext FROM npay_registration_results WHERE checkout_id=${checkout.id}`;
    if (!stored) throw conflict();
    return decrypt(stored.ciphertext, checkout.id, key);
  }
  if (!await claimNpayRegistration(checkout.id)) throw conflict();
  try {
    const body = buildOrderXml({ config, backUrl, naverInflowCode, saClickId,
      items: products.map(product => ({ product, quantity: items.find(item => item.id === product.id).quantity,
        option: product.options[0] || null })) });
    const response = await request(config.orderRegistrationUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body, redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    if (text.length > 16_384) throw new Error();
    const result = naverOrderResult(text);
    if (!response.ok || !result.ok) throw new Error();
    const value = { key: result.key, merchantNo: result.merchantNo };
    const sql = database();
    const [, saved] = await sql.transaction([
      sql.query(INVENTORY_LOCK),
      sql`INSERT INTO npay_registration_results(checkout_id,ciphertext)
        SELECT id,${encrypt(value,checkout.id,key)} FROM npay_checkouts WHERE id=${checkout.id} AND phase='registering'
        ON CONFLICT(checkout_id) DO NOTHING RETURNING checkout_id`,
      sql`UPDATE npay_checkouts SET phase='registered',updated_at=now() WHERE id=${checkout.id} AND phase='registering'`,
    ]);
    if (!saved.length) throw conflict();
    return value;
  } catch {
    await recordNpayRegistrationOutcome(checkout.id, 'uncertain').catch(() => {});
    throw failure(502, '네이버페이 주문 등록 결과를 확인할 수 없습니다. 중복 결제를 방지하기 위해 재고 예약을 유지합니다.');
  }
}
