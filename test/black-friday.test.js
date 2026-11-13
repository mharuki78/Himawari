import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neonConfig } from '@neondatabase/serverless';
import { fetch as storefront } from '../api/storefront.js';
import { fetch as productsApi } from '../api/products.js';
import { createOrder, ensureOrderSchema } from '../api/_lib/orders.js';
import { readPublicBlackFriday, readBlackFridayAdmin, saveBlackFriday } from '../api/_lib/black-friday.js';
import { seedCatalog, publicProduct } from '../api/_lib/products.js';
import { PGlite } from '@electric-sql/pglite';
import { blackFridayCatalogRows, blackFridayOrderGate, blackFridayState, validateBlackFriday } from '../api/_lib/black-friday.js';
import { CANCEL_ORDER_SQL } from '../api/_lib/order-transactions.js';

const blank = { id: null, revision: 0, enabled: false, items: [] };
const catalog = blackFridayCatalogRows([
  { id: 'bag', name: 'Bag', price: 59_000, options: [{ id: 'green', label: 'Green', stock: 4 }, { id: 'navy', label: 'Navy', stock: 2 }] },
]);
const input = { enabled: true, startsAt: '2026-11-27T09:00', endsAt: '2026-11-28T00:00', items: [{ productId: 'bag', optionId: 'green', price: 39_000, quantity: 3 }] };
const ready = validateBlackFriday(input, blank, catalog);
const start = Date.parse('2026-11-27T00:00:00Z');
const end = Date.parse('2026-11-27T15:00:00Z');

test('interprets all admin times in Korea and treats the end as exclusive', () => {
  assert.equal(Date.parse(ready.startsAt), start);
  assert.equal(Date.parse(ready.endsAt), end);
  assert.equal(blackFridayState(blank, start), 'inactive');
  assert.equal(blackFridayState(ready, start - 1), 'scheduled');
  assert.equal(blackFridayState(ready, start), 'open');
  assert.equal(blackFridayState(ready, end - 1), 'open');
  assert.equal(blackFridayState(ready, end), 'closed');
  assert.throws(() => validateBlackFriday({ ...input, startsAt: '2026-02-30T12:00' }, blank, catalog), { status: 400 });
  assert.throws(() => validateBlackFriday({ ...input, endsAt: input.startsAt }, blank, catalog), { status: 400 });
  assert.throws(() => validateBlackFriday({ ...input, items: [] }, blank, catalog), { status: 400 });
  assert.equal(validateBlackFriday({ enabled: false, items: [] }, blank, catalog).enabled, false);
});

test('checks catalog variant, price, quantity and unique entries, and preserves current offer identities', () => {
  for (const change of [{ optionId: '' }, { optionId: 'invalid' }, { price: 59_000 }, { price: 0 }, { quantity: 0 }, { quantity: 1.5 }]) {
    assert.throws(() => validateBlackFriday({ ...input, items: [{ ...input.items[0], ...change }] }, ready, catalog), { status: 400 });
  }
  assert.throws(() => validateBlackFriday({ ...input, items: [input.items[0], input.items[0]] }, ready, catalog), { status: 400 });
  const priceChange = validateBlackFriday({ ...input, items: [{ ...input.items[0], price: 34_000 }] }, ready, catalog, start);
  assert.equal(priceChange.id, ready.id);
  assert.equal(priceChange.items[0].offerId, ready.items[0].offerId);
  const next = validateBlackFriday({ ...input, startsAt: '2026-12-01T09:00', endsAt: '2026-12-02T00:00' }, ready, catalog, end);
  assert.notEqual(next.id, ready.id);
  assert.notEqual(next.items[0].offerId, ready.items[0].offerId);
});

test('PostgreSQL rejects stale prices, closed schedules and depleted quotas; cancellation restores the right SKU', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE black_friday_campaign (singleton boolean DEFAULT true, id text, enabled boolean, starts_at timestamptz, ends_at timestamptz, items jsonb);
      CREATE TABLE orders (id text PRIMARY KEY, black_friday_id text, order_number text, revision int DEFAULT 1, status text DEFAULT 'payment_pending', tracking_number text, updated_at timestamptz);
      CREATE TABLE inventory_reservations (order_id text REFERENCES orders(id), product_id text, option_id text, quantity int, active boolean DEFAULT true, updated_at timestamptz);
      CREATE TABLE npay_inventory_reservations(product_id text,option_id text,held_quantity integer,campaign_id text);
      CREATE TABLE coupon_claims (id text, order_id text, used_at timestamptz);
      CREATE TABLE order_events (id text, order_id text, actor text, from_status text, to_status text, note text);
    `);
    const offer = ready.items[0];
    const scope = { campaignId: ready.id, offer, product: catalog[0] };
    const gate = async (quantity, overrides = {}) => {
      const { text, values } = blackFridayOrderGate({ ...scope, ...overrides }, quantity);
      return db.query(text, values);
    };
    await db.query("INSERT INTO black_friday_campaign (id, enabled, starts_at, ends_at, items) VALUES ($1,true,now()-interval '1 minute',now()+interval '1 hour',$2::jsonb)", [ready.id, JSON.stringify([offer])]);
    await gate(3);
    await assert.rejects(gate(1, { offer: { ...offer, price: 1000 } }), { code: '22012' });
    await assert.rejects(gate(1, { offer: { ...offer, optionId: 'navy' } }), { code: '22012' });
    await db.query("INSERT INTO orders (id, black_friday_id, order_number) VALUES ('sale',$1,'sale-no'),('retail',NULL,'retail-no'),('other',NULL,'other-no')", [ready.id]);
    await db.exec("INSERT INTO inventory_reservations (order_id,product_id,option_id,quantity) VALUES ('sale','bag','green',2),('retail','bag','green',1),('other','bag','navy',1)");
    await gate(1);
    await assert.rejects(gate(2), { code: '22012' });
    await assert.rejects(gate(1, { product: { stock: 3 } }), { code: '22012' });
    await db.query(CANCEL_ORDER_SQL, ['cancelled',null,'sale-no',1,'payment_pending','event','cancelled']);
    await gate(3);
    await db.exec("UPDATE black_friday_campaign SET ends_at=clock_timestamp()");
    await assert.rejects(gate(1), { code: '22012' });
    await db.exec("UPDATE black_friday_campaign SET starts_at=now()+interval '1 hour', ends_at=now()+interval '2 hours'");
    await assert.rejects(gate(1), { code: '22012' });
  } finally { await db.close(); }
});

test('two buyers racing for the last unit leave one discounted order and one reservation', async () => {
  const db = new PGlite();
  const oldFetch = neonConfig.fetchFunction;
  const env = { DATABASE_URL: process.env.DATABASE_URL, BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN, PRODUCT_BLOB_READ_WRITE_TOKEN: process.env.PRODUCT_BLOB_READ_WRITE_TOKEN };
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/himawari';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  const pgText = value => {
    if (value === null) return null;
    if (typeof value === 'boolean') return value ? 't' : 'f';
    if (value instanceof Date) return value.toISOString().replace('T', ' ').replace(/Z$/, '+00');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  neonConfig.fetchFunction = async (_url, { body }) => {
    const { queries, query, params } = JSON.parse(body);
    const run = async (executor, query, params) => {
      const { fields, rows } = await executor.query(query, params);
      return { fields, rows: rows.map(row => fields.map(field => pgText(row[field.name]))) };
    };
    try {
      if (!queries) return Response.json(await run(db, query, params));
      return Response.json({ results: await db.transaction(async tx => {
        const results = [];
        for (const request of queries) results.push(await run(tx, request.query, request.params));
        return results;
      }) });
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  try {
    await db.exec('CREATE TABLE users (id text PRIMARY KEY)');
    assert.equal((await readPublicBlackFriday({ statusOnly: true })).state, 'inactive');
    const product = blackFridayCatalogRows(seedCatalog().products.map(publicProduct)).find(item => item.regularPrice > 1000 && (item.stock === null || item.stock >= 2));
    assert.ok(product, 'seed catalog needs a real in-stock fixture');
    const kst = ms => new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);
    const schedule = { revision: 0, enabled: true, startsAt: kst(Date.now() - 3600_000), endsAt: kst(Date.now() + 3600_000),
      items: [{ productId: product.productId, optionId: product.optionId, quantity: 1, price: 1000 }] };
    await ensureOrderSchema();
    await saveBlackFriday(schedule);
    await assert.rejects(saveBlackFriday(schedule), { status: 409 });
    const event = await readPublicBlackFriday({ prepareOrders: ensureOrderSchema });
    assert.equal(event.state, 'open');
    assert.equal(event.items[0]?.remaining, 1, JSON.stringify(event));
    const sale = { offerId: event.items[0].offerId, unitPrice: 1000 };
    const root = 'https://himawari.co.kr';
    const itemPage = () => storefront(new Request(root + '/api/storefront?page=black-friday-item&offer=' + sale.offerId));
    const schema = source => JSON.parse(source.match(/<script id="bf-json-ld" type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    const sitemap = async () => (await productsApi(new Request(root + '/api/products?route=black-friday-sitemap'))).text();
    const itemUrl = root + '/black-friday/item/' + sale.offerId + '/';
    const landing = await storefront(new Request(root + '/api/storefront?page=black-friday'));
    assert.equal(landing.status, 200);
    assert.equal(landing.headers.get('cache-control'), 'no-store');
    const landingHtml = await landing.text();
    assert.equal(schema(landingHtml).mainEntity.itemListElement[0].url, itemUrl);
    assert.match(landingHtml, /1,000원/);
    const itemResponse = await itemPage();
    const openProduct = schema(await itemResponse.text());
    assert.equal(itemResponse.status, 200);
    assert.equal(openProduct['@type'], 'Product');
    assert.equal(openProduct.offers.price, 1000);
    assert.equal(openProduct.offers.priceCurrency, 'KRW');
    assert.equal(openProduct.offers.availability, 'https://schema.org/InStock');
    assert.equal(openProduct.offers.validThrough, event.endsAt);
    assert.ok((await sitemap()).includes(itemUrl));
    const makeOrder = () => ({
      requestId: randomUUID(), recipientName: '테스트', email: 'test@example.invalid', phone: '010-1234-5678',
      postalCode: '12345', addressLine1: '테스트로 123', termsConsent: true, privacyConsent: true,
      items: [{ productId: product.productId, optionId: product.optionId, quantity: 1 }],
      blackFriday: sale,
    });
    await assert.rejects(createOrder(null, { ...makeOrder(), blackFriday: { ...sale, unitPrice: 1 } }), { status: 409 });
    const requests = [makeOrder(), makeOrder()];
    const outcomes = await Promise.allSettled(requests.map(input => createOrder(null, input)));
    const succeeded = outcomes.findIndex(outcome => outcome.status === 'fulfilled');
    assert.ok(succeeded >= 0, outcomes.map(outcome => outcome.reason?.message).join('; '));
    assert.equal(outcomes[1 - succeeded].reason.status, 409);
    const { order } = outcomes[succeeded].value;
    assert.equal(order.blackFriday, true);
    assert.equal(order.subtotal, 1000);
    assert.equal(order.total, 4500);
    assert.equal((await createOrder(null, requests[succeeded])).duplicate, true);
    assert.equal((await readBlackFridayAdmin()).config.items[0].used, 1);
    assert.equal((await readPublicBlackFriday({ prepareOrders: ensureOrderSchema })).items[0].remaining, 0);
    const soldOut = await (await itemPage()).text();
    assert.equal(schema(soldOut).offers.availability, 'https://schema.org/OutOfStock');
    assert.doesNotMatch(soldOut, /blackFriday=/);
    const retail = await createOrder(null, { ...makeOrder(), blackFriday: undefined });
    assert.equal(retail.order.blackFriday, false);
    assert.equal(retail.order.subtotal, product.regularPrice);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM orders')).rows[0].count, 2);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM inventory_reservations WHERE active')).rows[0].count, 1);
    await saveBlackFriday({ ...schedule, revision: 1, enabled: false });
    assert.equal((await readPublicBlackFriday({ prepareOrders: ensureOrderSchema })).items.length, 0);
    const endedItem = await itemPage();
    assert.equal(endedItem.status, 404);
    assert.doesNotMatch(await endedItem.text(), /bf-json-ld|1,000원|blackFriday=/);
    const endedLanding = await storefront(new Request(root + '/api/storefront?page=black-friday'));
    const endedHtml = await endedLanding.text();
    assert.equal(schema(endedHtml)['@type'], 'CollectionPage');
    assert.doesNotMatch(endedHtml, /ItemList|1,000원|blackFriday=/);
    assert.ok((await sitemap()).includes(root + '/black-friday/'));
    assert.ok(!(await sitemap()).includes(itemUrl));
    await assert.rejects(createOrder(null, makeOrder()), { status: 409 });
  } finally {
    neonConfig.fetchFunction = oldFetch;
    for (const [name, value] of Object.entries(env)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await db.close();
  }
});
