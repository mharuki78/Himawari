import { randomUUID } from 'node:crypto';
import { database } from './database.js';
import { applyInventoryReservations } from './inventory.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './products.js';

export const INVENTORY_LOCK = "SELECT pg_advisory_xact_lock(hashtext('himawari_inventory'))";
export const BLACK_FRIDAY_LIMIT = 100;
const blank = { id: null, revision: 0, enabled: false, startsAt: null, endsAt: null, items: [] };
let schemaPromise;

export function ensureBlackFridaySchema() {
  if (!schemaPromise) {
    const sql = database();
    schemaPromise = sql`CREATE TABLE IF NOT EXISTS black_friday_campaign (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      id text NOT NULL,
      revision integer NOT NULL,
      enabled boolean NOT NULL,
      starts_at timestamptz,
      ends_at timestamptz,
      items jsonb NOT NULL
    )`.catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

export function blackFridayState(config, now = Date.now()) {
  if (!config.enabled || !config.startsAt || !config.endsAt || !config.items.length) return 'inactive';
  if (now < Date.parse(config.startsAt)) return 'scheduled';
  if (now >= Date.parse(config.endsAt)) return 'closed';
  return 'open';
}

function error(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function blackFridayUnavailable() {
  return error('행사가 끝났거나 가격 또는 남은 수량이 바뀌었습니다. 블랙 프라이데이에서 다시 확인해 주세요.', 409);
}

function parseKst(value) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw error('한국 시간 기준 날짜와 시각을 확인해 주세요.');
  const time = Date.parse(value + ':00+09:00');
  if (!Number.isFinite(time) || new Date(time + 9 * 3600_000).toISOString().slice(0, 16) !== value) throw error('한국 시간 기준 날짜와 시각을 확인해 주세요.');
  return new Date(time).toISOString();
}

export function blackFridayCatalogRows(products) {
  return products.filter(product => Number.isSafeInteger(product.price) && product.price > 0).flatMap(product => {
    const { id: productId, name, model, image, price: regularPrice } = product;
    return (product.options?.length ? product.options : [{ id: '', label: '', stock: product.stock }])
      .map(({ id: optionId, label: optionLabel, stock }) => ({ productId, optionId, optionLabel, name, model, image, regularPrice, stock }));
  });
}

const key = ({ productId, optionId }) => JSON.stringify([productId, optionId || '']);
const toMap = rows => new Map(rows.map(row => [key(row), row]));

export function validateBlackFriday(input, current, catalog, now = Date.now()) {
  if (!input || typeof input.enabled !== 'boolean' || !Array.isArray(input.items) || input.items.length > BLACK_FRIDAY_LIMIT) throw error('행사 설정을 확인해 주세요. 품목은 최대 100개까지 추가할 수 있습니다.');
  const startsAt = parseKst(input.startsAt);
  const endsAt = parseKst(input.endsAt);
  if ((startsAt && endsAt && startsAt >= endsAt) || (input.enabled && (!startsAt || !endsAt || !input.items.length))) throw error('시작보다 늦은 종료 일시와 행사 품목을 입력해 주세요.');
  const renew = current.endsAt && Date.parse(current.endsAt) <= now && Date.parse(startsAt) >= Date.parse(current.endsAt) && Date.parse(endsAt) > now;
  const previous = renew ? new Map() : toMap(current.items);
  const available = toMap(catalog);
  const seen = new Set();
  const items = input.items.map((item, index) => {
    if (!item || typeof item.productId !== 'string' || typeof item.optionId !== 'string') throw error(`${index + 1}번째 품목을 선택해 주세요.`);
    const sku = key(item);
    const product = available.get(sku);
    const { productId, optionId, price, quantity } = item;
    if (!product || seen.has(sku)) throw error(`${index + 1}번째 품목을 확인해 주세요. 같은 상품과 옵션은 한 번만 추가할 수 있습니다.`);
    if (!Number.isSafeInteger(price) || price < 1 || price >= product.regularPrice) throw error(`${index + 1}번째 행사가를 1원 이상, 정상가 미만으로 입력해 주세요.`);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99_999) throw error(`${index + 1}번째 행사 수량을 1~99,999개 사이로 입력해 주세요.`);
    seen.add(sku);
    return { productId, optionId, price, quantity, offerId: previous.get(sku)?.offerId || randomUUID() };
  });
  return { id: renew || !current.id ? randomUUID() : current.id, revision: current.revision + 1, enabled: input.enabled, startsAt, endsAt, items };
}

export async function readBlackFriday() {
  let row;
  try {
    [row] = await database()`SELECT * FROM black_friday_campaign WHERE singleton`;
  } catch (reason) {
    if (reason?.code !== '42P01') throw reason;
  }
  if (!row) return { ...blank, items: [] };
  return { id: row.id, revision: row.revision, enabled: row.enabled, startsAt: row.starts_at?.toISOString?.() ?? row.starts_at, endsAt: row.ends_at?.toISOString?.() ?? row.ends_at, items: row.items };
}

export async function readBlackFridayCatalog() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return catalog.products.map(publicProduct);
}

async function readUsage(campaignId) {
  if (!campaignId) return new Map();
  const rows = await database()`SELECT r.product_id AS "productId", r.option_id AS "optionId", sum(r.quantity)::int AS used
    FROM inventory_reservations r JOIN orders o ON o.id = r.order_id
    WHERE r.active AND o.black_friday_id = ${campaignId} GROUP BY r.product_id, r.option_id`;
  return toMap(rows);
}

export async function readBlackFridayAdmin(config) {
  config ??= await readBlackFriday();
  const [products, usage] = await Promise.all([readBlackFridayCatalog(), readUsage(config.id)]);
  return {
    config: { ...config, items: config.items.map(item => ({ ...item, used: usage.get(key(item))?.used || 0 })) },
    catalog: blackFridayCatalogRows(products).map(({ image, ...row }) => row),
    state: blackFridayState(config),
  };
}

export async function saveBlackFriday(input) {
  await ensureBlackFridaySchema();
  const current = await readBlackFriday();
  if (input?.revision !== current.revision) throw error('다른 곳에서 행사 설정이 바뀌었습니다. 설정을 다시 불러와 주세요.', 409);
  const next = validateBlackFriday(input, current, blackFridayCatalogRows(await readBlackFridayCatalog()));
  const sql = database();
  const [, rows] = await sql.transaction([
    sql.query(INVENTORY_LOCK),
    sql`INSERT INTO black_friday_campaign AS c (id, revision, enabled, starts_at, ends_at, items)
      VALUES (${next.id}, ${next.revision}, ${next.enabled}, ${next.startsAt}, ${next.endsAt}, ${JSON.stringify(next.items)}::jsonb)
      ON CONFLICT (singleton) DO UPDATE SET id = excluded.id, revision = excluded.revision, enabled = excluded.enabled,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at, items = excluded.items
      WHERE c.revision = ${current.revision}
      RETURNING revision`,
  ], { isolationLevel: 'ReadCommitted' });
  if (!rows.length) throw error('다른 곳에서 행사 설정이 바뀌었습니다. 설정을 다시 불러와 주세요.', 409);
  return next;
}

export async function readPublicBlackFriday({ statusOnly = false, prepareOrders } = {}) {
  const config = await readBlackFriday();
  const now = Date.now();
  const state = blackFridayState(config, now);
  const result = { state, serverTime: new Date(now).toISOString(), startsAt: state === 'inactive' ? null : config.startsAt, endsAt: state === 'inactive' ? null : config.endsAt };
  if (statusOnly) return result;
  if (state !== 'open') return { ...result, items: [] };
  await prepareOrders();
  const [products, usage] = await Promise.all([readBlackFridayCatalog().then(applyInventoryReservations), readUsage(config.id)]);
  const catalog = toMap(blackFridayCatalogRows(products));
  const items = config.items.flatMap(item => {
    const product = catalog.get(key(item));
    if (!product || item.price >= product.regularPrice) return [];
    const remaining = Math.max(0, Math.min(item.quantity - (usage.get(key(item))?.used || 0), product.stock ?? Infinity));
    const { stock, ...details } = product;
    return [{ ...details, offerId: item.offerId, price: item.price, remaining }];
  });
  return { ...result, items };
}

export async function resolveBlackFridayOrder(offerId, price, item, catalog) {
  const config = await readBlackFriday();
  const offer = config.items.find(entry => entry.offerId === offerId && key(entry) === key(item));
  const product = toMap(blackFridayCatalogRows(catalog)).get(key(item));
  if (blackFridayState(config) !== 'open' || !offer || !product || offer.price !== price || offer.price >= product.regularPrice) throw blackFridayUnavailable();
  return { campaignId: config.id, offer, product };
}

export function blackFridayOrderGate({ campaignId, offer, product }, quantity) {
  return {
    text: `SELECT 1 / CASE WHEN EXISTS (
      SELECT 1 FROM black_friday_campaign c CROSS JOIN LATERAL jsonb_array_elements(c.items) AS x(item)
      WHERE c.singleton AND c.id = $1 AND c.enabled
        AND c.starts_at <= clock_timestamp() AND c.ends_at > clock_timestamp()
        AND x.item->>'offerId' = $2 AND x.item->>'productId' = $3 AND x.item->>'optionId' = $4
        AND (x.item->>'price')::int = $5
        AND (x.item->>'quantity')::int >= $6 + COALESCE((
          SELECT sum(r.quantity) FROM inventory_reservations r JOIN orders o ON o.id = r.order_id
          WHERE r.active AND r.product_id = $3 AND r.option_id = $4 AND o.black_friday_id = $1
        ), 0)
        AND ($7::int IS NULL OR $7 >= $6 + COALESCE((
          SELECT sum(r.quantity) FROM inventory_reservations r WHERE r.active AND r.product_id = $3 AND r.option_id = $4
        ), 0))
    ) THEN 1 ELSE 0 END`,
    values: [campaignId, offer.offerId, offer.productId, offer.optionId, offer.price, quantity, product.stock ?? null],
  };
}
