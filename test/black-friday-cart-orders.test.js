import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import seedPayload from '../products.json' with { type: 'json' };
import { createOrder, ensureOrderSchema, validateOrderItems, updateOrderByAdmin } from '../api/_lib/orders.js';
import { ensureBlackFridaySchema, readPublicBlackFriday, validateBlackFriday } from '../api/_lib/black-friday.js';
import { ensureCouponSchema } from '../api/_lib/coupon-claims.js';

const offerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const offerB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sale = (offerId = offerA, unitPrice = 10000) => ({ offerId, unitPrice });
const line = (productId, quantity = 1, blackFriday) => ({ productId, optionId: '', quantity, ...(blackFriday ? { blackFriday } : {}) });
const request = items => ({ requestId: randomUUID(), recipientName: 'Fixture Buyer', email: 'buyer@example.invalid',
  phone: '010-0000-0000', postalCode: '00000', addressLine1: 'Synthetic fixture address', termsConsent: true, privacyConsent: true, items });

test('order item validation retains locked campaign identity and rejects malformed context and duplicate SKUs', () => {
  const item = line('bag-a', 2, sale());
  assert.deepEqual(validateOrderItems([item]).items, [item]);
  for (const blackFriday of [null, {}, { offerId: offerA, unitPrice: '10000' }, sale('other'), sale(offerA, 0)]) {
    assert.equal(validateOrderItems([{ ...item, blackFriday }]).valid, false);
  }
  assert.equal(validateOrderItems([item, line('bag-a')]).valid, false);
});

test('campaign configuration accepts 1000 unique SKUs and rejects the 1001st', () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({ productId: 'sku-' + i, optionId: '', regularPrice: 20000 }));
  const items = rows.map(({ productId, optionId }) => ({ productId, optionId, price: 10000, quantity: 1 }));
  const input = { enabled: false, items: items.slice(0, 1000) };
  assert.equal(validateBlackFriday(input, { items: [] }, rows).items.length, 1000);
  assert.throws(() => validateBlackFriday({ ...input, items }, { items: [] }, rows), { status: 400 });
});

test('mixed campaign orders use isolated PostgreSQL for pricing, quota, inventory, replay and rollback', async t => {
  const db = new PGlite();
  const previousNeon = neonConfig.fetchFunction;
  const previousProducts = seedPayload.products;
  const envNames = ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'PRODUCT_BLOB_READ_WRITE_TOKEN'];
  const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/cart-test';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  // This JSON import is process-local. No catalog file or external data is changed.
  seedPayload.products = [
    { id: 'bag-a', name: 'Fixture A', model: 'A', price: 30000, stock: 10 },
    { id: 'bag-b', name: 'Fixture B', model: 'B', price: 50000, stock: 10 },
    { id: 'bag-c', name: 'Fixture C', model: 'C', price: 40000, stock: 1 },
  ];
  let beforeTransaction;
  const pgText = value => value === null ? null : value instanceof Date ? value.toISOString().replace('T', ' ').replace(/Z$/, '+00') : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 't' : 'f') : String(value);
  neonConfig.fetchFunction = async (_url, { body }) => {
    const { queries, query, params } = JSON.parse(body);
    const run = async (executor, query, params) => {
      const { fields, rows } = await executor.query(query, params);
      return { fields, rows: rows.map(row => fields.map(field => pgText(row[field.name]))) };
    };
    try {
      if (!queries) return Response.json(await run(db, query, params));
      if (beforeTransaction && queries.some(item => item.query.includes('INSERT INTO orders'))) {
        const change = beforeTransaction; beforeTransaction = null; await change();
      }
      return Response.json({ results: await db.transaction(async tx => {
        const results = [];
        for (const item of queries) results.push(await run(tx, item.query, item.params));
        return results;
      }) });
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  const defaultOffers = () => [
    { productId: 'bag-a', optionId: '', offerId: offerA, price: 10000, quantity: 10 },
    { productId: 'bag-b', optionId: '', offerId: offerB, price: 20000, quantity: 10 },
  ];
  const reset = async (offers = defaultOffers()) => {
    beforeTransaction = null;
    await db.exec('TRUNCATE orders CASCADE; DELETE FROM black_friday_campaign');
    await db.query("INSERT INTO black_friday_campaign(singleton,id,revision,enabled,starts_at,ends_at,items) VALUES(true,'fixture-campaign',1,true,now()-interval '1 hour',now()+interval '1 hour',$1::jsonb)", [JSON.stringify(offers)]);
  };
  const event = () => readPublicBlackFriday({ prepareOrders: ensureOrderSchema });
  const count = async table => (await db.query('SELECT count(*)::int AS n FROM ' + table)).rows[0].n;
  try {
    await db.exec('CREATE TABLE users(id text PRIMARY KEY)');
    await ensureOrderSchema(); await ensureBlackFridaySchema(); await ensureCouponSchema();

    await t.test('two discounted lines and a regular line keep their own prices and reserve every physical SKU', async () => {
      await reset();
      const { order } = await createOrder(null, request([line('bag-a', 2, sale()), line('bag-b', 1, sale(offerB, 20000)), line('bag-c')]));
      assert.equal(order.subtotal, 80000); assert.equal(order.shippingFee, 0); assert.equal(order.total, 80000);
      assert.deepEqual(order.items.map(item => [item.productId, item.unitPrice]).sort(), [['bag-a', 10000], ['bag-b', 20000], ['bag-c', 40000]]);
      assert.deepEqual(order.items.find(item => item.productId === 'bag-a').blackFriday, sale());
      assert.equal(order.items.find(item => item.productId === 'bag-c').blackFriday, undefined);
      assert.equal(await count('inventory_reservations'), 3);
      assert.deepEqual((await event()).items.map(item => [item.productId, item.remaining]), [['bag-a', 8], ['bag-b', 9]]);
      // A regular line in a mixed order must not become campaign usage when that SKU is added later.
      const offers = [...defaultOffers(), { productId: 'bag-c', optionId: '', offerId: randomUUID(), price: 15000, quantity: 5 }];
      await db.query('UPDATE black_friday_campaign SET items=$1::jsonb', [JSON.stringify(offers)]);
      seedPayload.products[2].stock = 10;
      try { assert.equal((await event()).items.find(item => item.productId === 'bag-c').remaining, 5); }
      finally { seedPayload.products[2].stock = 1; }
    });

    await t.test('exact replay is idempotent and changed quantity, SKU, offer or locked price conflicts', async () => {
      await reset();
      const input = request([line('bag-a', 1, sale()), line('bag-c')]);
      const first = await createOrder(null, input);
      assert.equal((await createOrder(null, { ...input, items: [...input.items].reverse() })).duplicate, true);
      for (const items of [
        [line('bag-a', 2, sale()), line('bag-c')], [line('bag-b', 1, sale()), line('bag-c')],
        [line('bag-a', 1, sale(offerB)), line('bag-c')], [line('bag-a', 1, sale(offerA, 9999)), line('bag-c')],
        [line('bag-a'), line('bag-c')], [line('bag-a', 1, sale())],
      ]) await assert.rejects(createOrder(null, { ...input, items }), { status: 409 });
      assert.equal(await count('orders'), 1); assert.equal(first.order.items.length, 2);
    });

    await t.test('last campaign unit admits one mixed order and cancel/confirm preserve attribution and release all its SKUs', async () => {
      await reset([{ ...defaultOffers()[0], quantity: 1 }]);
      const intent = () => request([line('bag-a', 1, sale()), line('bag-b')]);
      const results = await Promise.allSettled([createOrder(null, intent()), createOrder(null, intent())]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(await count('orders'), 1); assert.equal(await count('inventory_reservations'), 2);
      const order = results.find(result => result.status === 'fulfilled').value.order;
      const confirmed = await updateOrderByAdmin({ orderNumber: order.orderNumber, revision: 1, status: 'confirmed' });
      assert.deepEqual(confirmed.items.find(item => item.productId === 'bag-a').blackFriday, sale());
      assert.equal((await event()).items[0].remaining, 0);
      await updateOrderByAdmin({ orderNumber: order.orderNumber, revision: 2, status: 'cancelled' });
      assert.equal((await db.query('SELECT count(*)::int AS n FROM inventory_reservations WHERE active')).rows[0].n, 0);
      assert.equal((await event()).items[0].remaining, 1);
      const replacement = await createOrder(null, intent()); assert.equal(replacement.duplicate, false);
    });

    await t.test('a last regular-stock unit in mixed orders is reserved atomically with the discounted line', async () => {
      await reset();
      const results = await Promise.allSettled([1, 2].map(() => createOrder(null, request([line('bag-a', 1, sale()), line('bag-c')]))));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(await count('orders'), 1); assert.equal(await count('order_items'), 2); assert.equal(await count('inventory_reservations'), 2);
      assert.equal((await event()).items[0].remaining, 9);
    });

    await t.test('invented option IDs cannot alias one optionless SKU and bypass its stock gate', async () => {
      await reset();
      const aliasedLines = [
        line('bag-a', 1, sale()),
        { ...line('bag-c'), optionId: 'phantom-1' },
        { ...line('bag-c'), optionId: 'phantom-2' },
      ];
      await assert.rejects(createOrder(null, request(aliasedLines)), { status: 409 });
      for (const table of ['orders', 'order_items', 'order_events', 'inventory_reservations']) assert.equal(await count(table), 0, table);
      const { order } = await createOrder(null, request([line('bag-a', 1, sale()), line('bag-c')]));
      assert.equal(order.items.filter(item => item.productId === 'bag-c').length, 1);
      assert.equal((await db.query("SELECT sum(quantity)::int AS n FROM inventory_reservations WHERE active AND product_id='bag-c'")).rows[0].n, 1);
    });

    await t.test('price changes, closure and depleted quota after preview roll back every line and order record', async () => {
      for (const mutation of [
        async () => db.query('UPDATE black_friday_campaign SET items=$1::jsonb', [JSON.stringify([defaultOffers()[0], { ...defaultOffers()[1], price: 19000 }])]),
        async () => db.exec('UPDATE black_friday_campaign SET ends_at=clock_timestamp()'),
        async () => db.query('UPDATE black_friday_campaign SET items=$1::jsonb', [JSON.stringify([defaultOffers()[0], { ...defaultOffers()[1], quantity: 0 }])]),
      ]) {
        await reset(); beforeTransaction = mutation;
        await assert.rejects(createOrder(null, request([line('bag-a', 1, sale()), line('bag-b', 1, sale(offerB, 20000)), line('bag-c')])), { status: 409 });
        for (const table of ['orders', 'order_items', 'order_events', 'inventory_reservations']) assert.equal(await count(table), 0, table);
      }
      await reset(); await db.exec("UPDATE black_friday_campaign SET ends_at=now()-interval '1 second'");
      await assert.rejects(createOrder(null, request([line('bag-a', 1, sale()), line('bag-c')])), { status: 409 });
      assert.equal(await count('orders'), 0);
    });

    await t.test('legacy single-offer orders and historical rows retain quota and replay compatibility without backfill', async () => {
      await reset();
      const input = { ...request([line('bag-a')]), blackFriday: sale() };
      await createOrder(null, input);
      await db.exec('UPDATE order_items SET black_friday_id=NULL,black_friday_offer_id=NULL; UPDATE inventory_reservations SET black_friday_id=NULL,black_friday_offer_id=NULL');
      assert.equal((await createOrder(null, { ...input, blackFriday: undefined, items: [line('bag-a', 1, sale())] })).duplicate, true);
      assert.equal((await event()).items[0].remaining, 9);
      assert.equal((await db.query('SELECT black_friday_id FROM order_items')).rows[0].black_friday_id, null);
      await assert.rejects(createOrder(null, { ...input, items: [line('bag-a', 2)] }), { status: 409 });
    });

    await t.test('any discounted line blocks coupons and ordinary order replay still compares quantities', async () => {
      await reset();
      for (const couponId of ['welcome-10', 'some-coupon']) await assert.rejects(createOrder(null, { ...request([line('bag-a', 1, sale()), line('bag-c')]), couponId }), { status: 409 });
      assert.equal(await count('orders'), 0);
      const input = request([line('bag-a')]);
      await createOrder(null, input);
      await assert.rejects(createOrder(null, { ...input, items: [line('bag-a', 2)] }), { status: 409 });
    });
  } finally {
    neonConfig.fetchFunction = previousNeon; seedPayload.products = previousProducts;
    for (const [name, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await db.close();
  }
});
