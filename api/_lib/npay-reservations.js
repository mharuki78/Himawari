import { createHash, randomUUID } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';
import { ensureOrderSchema } from './orders.js';
import { blackFridayOrderGate, blackFridayRegularStockGate, blackFridayState, INVENTORY_LOCK, readBlackFriday, resolveBlackFridayOrder } from './black-friday.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';
import { PHYSICAL_INVENTORY_RESERVATIONS, ensureNpayReservationSchema } from './inventory-reservation-store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = () => Object.assign(new Error('네이버페이 예약 상태나 재고가 바뀌었습니다.'), { status: 409 });
const invalid = () => Object.assign(new Error('주문할 상품과 수량을 확인해 주세요.'), { status: 400 });

function normalizeInput(input) {
  if (!UUID.test(input?.requestId || '') || !Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw invalid();
  const seen = new Set();
  return input.items.map(item => {
    if (!item || typeof item.productId !== 'string' || !item.productId || item.productId.length > 120
      || typeof item.optionId !== 'string' || item.optionId.length > 120
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw invalid();
    const key = JSON.stringify([item.productId, item.optionId]);
    if (seen.has(key)) throw invalid();
    seen.add(key);
    const normalized = { productId: item.productId, optionId: item.optionId, quantity: item.quantity };
    if (Object.hasOwn(item, 'blackFriday')) {
      const sale = item.blackFriday;
      if (!sale || !UUID.test(sale.offerId || '') || !Number.isSafeInteger(sale.unitPrice) || sale.unitPrice < 1) throw invalid();
      normalized.blackFriday = { offerId: sale.offerId, unitPrice: sale.unitPrice };
    }
    return normalized;
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function readCheckout(requestId) {
  const sql = database();
  const [checkout] = await sql`SELECT * FROM npay_checkouts WHERE request_id=${requestId}`;
  if (!checkout) return null;
  const items = await sql`SELECT r.*, c.catalog_revision FROM npay_inventory_reservations r
    JOIN npay_checkouts c ON c.id=r.checkout_id WHERE c.id=${checkout.id} ORDER BY r.id`;
  return { checkout, items };
}

// Internal allocator only. Public Npay routes remain guarded until registration,
// authenticated settlement and the ordinary/legacy Npay cutover are verified.
export async function reserveNpayCheckout(input) {
  const requested = normalizeInput(input);
  const fingerprint = createHash('sha256').update(JSON.stringify(requested)).digest('hex');
  await ensureOrderSchema();
  const previous = await readCheckout(input.requestId);
  if (previous) {
    if (previous.checkout.fingerprint !== fingerprint) throw conflict();
    return { ...previous, duplicate: true };
  }
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  const products = catalog.products.map(publicProduct);
  const byId = new Map(products.map(p => [p.id, p]));
  const lines = [];
  for (const item of requested) {
    const product = byId.get(item.productId);
    const option = product?.options?.find(o => o.id === item.optionId);
    if (!product || (product.options.length ? !option : item.optionId !== '')
      || !Number.isSafeInteger(product.price) || product.price < 1 || !product.name
      || !product.image.startsWith('https://')) throw conflict();
    const stock = option ? option.stock : product.stock;
    const event = item.blackFriday
      ? await resolveBlackFridayOrder(item.blackFriday.offerId, item.blackFriday.unitPrice, item, products) : null;
    const snapshot = { id: product.id, name: product.name, image: product.image, price: product.price,
      optionName: product.optionName, options: option ? [{ ...option }] : [] };
    lines.push({ id: `NPR-${randomUUID().replaceAll('-', '').slice(0, 24)}`, ...item, snapshot,
      unitPrice: event?.offer.price ?? product.price, regularPrice: product.price, event, baseStock: stock });
  }
  const sql = database();
  const id = randomUUID();
  const queries = [sql.query(INVENTORY_LOCK), sql.query(`SELECT 1 / CASE WHEN NOT EXISTS (
    SELECT 1 FROM npay_checkouts WHERE request_id=$1 AND fingerprint<>$2) THEN 1 ELSE 0 END`, [input.requestId, fingerprint])];
  for (const line of lines) {
    const gate = line.event ? blackFridayOrderGate(line.event, line.quantity) : blackFridayRegularStockGate(line);
    // A concurrent exact replay is not a second purchase and must not compete
    // against its own already-persisted holds.
    queries.push(sql.query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM npay_checkouts WHERE request_id=$${gate.values.length + 1})
      THEN 1 ELSE (${gate.text}) END`, [...gate.values, input.requestId]));
  }
  queries.push(sql`INSERT INTO npay_checkouts(id,request_id,fingerprint,catalog_revision)
    VALUES(${id},${input.requestId},${fingerprint},${catalog.revision}) ON CONFLICT(request_id) DO NOTHING`);
  for (const line of lines) queries.push(sql`INSERT INTO npay_inventory_reservations
    (id,checkout_id,product_id,option_id,quantity,held_quantity,campaign_id,offer_id,campaign_revision,unit_price,regular_price,snapshot)
    SELECT ${line.id},${id},${line.productId},${line.optionId},${line.quantity},${line.quantity},
      ${line.event?.campaignId ?? null},${line.event?.offer.offerId ?? null},${line.event?.campaignRevision ?? null},
      ${line.unitPrice},${line.regularPrice},${JSON.stringify(line.snapshot)}::jsonb
    WHERE EXISTS(SELECT 1 FROM npay_checkouts WHERE id=${id})`);
  try {
    await sql.transaction(queries, { isolationLevel: 'ReadCommitted' });
  } catch (error) {
    if (error.code === '22012') throw conflict();
    throw error;
  }
  const result = await readCheckout(input.requestId);
  return { ...result, duplicate: result.checkout.id !== id };
}

export async function claimNpayRegistration(id) {
  await ensureOrderSchema();
  const rows = await database()`UPDATE npay_checkouts SET phase='registering',updated_at=now()
    WHERE id=${id} AND phase='reserved' RETURNING id`;
  return rows.length === 1;
}

export async function recordNpayRegistrationOutcome(id, phase) {
  if (!['registered', 'uncertain'].includes(phase)) throw invalid();
  await ensureOrderSchema();
  const rows = await database()`UPDATE npay_checkouts SET phase=${phase},updated_at=now()
    WHERE id=${id} AND phase='registering' RETURNING id`;
  if (!rows.length) throw conflict();
}

export async function blockNpayCheckout(id) {
  await ensureOrderSchema();
  const rows = await database()`UPDATE npay_checkouts SET phase='blocked',updated_at=now() WHERE id=${id} RETURNING id`;
  return rows.length === 1;
}

// This projection is read-only. No GET, timeout, empty poll or campaign end is
// permission to release a hold. availableStock must include this reservation
// but exclude all other local/Npay holds, and come from a trusted server read.
export function projectNpayReservation(row, { product, campaign, catalogRevision, phase, availableStock, now = Date.now() }) {
  const snapshot = row.snapshot;
  const option = product?.options?.find(o => o.id === row.option_id);
  const sameSku = product?.id === row.product_id && (row.option_id ? Boolean(option) : !product?.options?.length);
  const offer = campaign?.items?.find(o => o.offerId === row.offer_id && o.productId === row.product_id && o.optionId === row.option_id);
  const validCampaign = !row.campaign_id || (campaign?.id === row.campaign_id
    && campaign.revision === row.campaign_revision && blackFridayState(campaign, now) === 'open'
    && offer?.price === row.unit_price && offer.price < product?.price);
  const valid = sameSku && catalogRevision === row.catalog_revision && product.price === row.regular_price
    && ['reserved', 'registering', 'registered'].includes(phase) && validCampaign && row.held_quantity === row.quantity;
  const stock = valid && (availableStock === null || Number.isSafeInteger(availableStock) && availableStock >= row.quantity)
    ? row.quantity : 0;
  const npaySaleStatus = !valid || availableStock === undefined ? 'NOT_SALE' : stock ? 'ON_SALE' : 'SOLD_OUT';
  return { id: row.id, physicalProductId: row.product_id, name: snapshot.name, image: snapshot.image,
    price: row.unit_price, stock, npaySaleStatus, optionName: snapshot.optionName,
    options: snapshot.options.map(o => ({ ...o, stock })) };
}

export const isReservedNpayProductId = id => /^NPR-[0-9a-f]{24}$/.test(id);

export async function readReservedNpayProducts(ids) {
  const requested = ids.filter(isReservedNpayProductId);
  if (!requested.length || !databaseIsConfigured()) return [];
  await ensureNpayReservationSchema();
  const sql = database();
  const rows = await sql.query(`SELECT r.*, c.phase, c.catalog_revision FROM npay_inventory_reservations r
    JOIN npay_checkouts c ON c.id=r.checkout_id WHERE r.id=ANY($1::text[])`, [requested]);
  if (!rows.length) return [];
  const [catalog, campaign, usage] = await Promise.all([
    productStoreIsConfigured() ? readProductCatalog().then(r => r.catalog) : seedCatalog(),
    readBlackFriday(),
    sql.query(`SELECT product_id,option_id,sum(quantity)::int AS used FROM (${PHYSICAL_INVENTORY_RESERVATIONS}) r
      WHERE active GROUP BY product_id,option_id`),
  ]);
  const key = (productId, optionId) => JSON.stringify([productId, optionId || '']);
  const products = new Map(catalog.products.map(publicProduct).map(p => [p.id, p]));
  const used = new Map(usage.map(r => [key(r.product_id, r.option_id), Number(r.used)]));
  return rows.map(row => {
    const product = products.get(row.product_id);
    const option = product?.options.find(o => o.id === row.option_id);
    const baseStock = option ? option.stock : product?.stock;
    const availableStock = baseStock === null ? null : Number(baseStock) - (used.get(key(row.product_id, row.option_id)) || 0) + row.held_quantity;
    return projectNpayReservation(row, { product, campaign, catalogRevision: catalog.revision, phase: row.phase, availableStock });
  });
}
