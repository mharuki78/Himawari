import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import seed from '../products.json' with { type: 'json' };
import { applyInventoryReservations } from '../api/_lib/inventory.js';
import { ensureOrderSchema, createOrder, updateOrderByAdmin } from '../api/_lib/orders.js';
import { ensureCouponSchema } from '../api/_lib/coupon-claims.js';
import { ensureBlackFridaySchema, readPublicBlackFriday } from '../api/_lib/black-friday.js';
import { fetchNpayProductInformation } from '../api/_lib/npay-handlers.js';
import { npayProductId, buildOrderXml } from '../api/_lib/npay.js';
const reservations = await import('../api/_lib/npay-reservations.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const reserve = (...args) => {
  assert.equal(typeof reservations.reserveNpayCheckout, 'function', 'durable Npay allocator is missing');
  return reservations.reserveNpayCheckout(...args);
};

const offerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sale = { offerId, unitPrice: 10000 };
const fields = items => ({ requestId: randomUUID(), recipientName: 'Fixture Buyer', email: 'buyer@example.invalid',
  phone: '010-0000-0000', postalCode: '00000', addressLine1: 'Synthetic fixture address',
  termsConsent: true, privacyConsent: true, items });

test('Npay allocation participates in local stock, campaign quota and confirmation under real PostgreSQL', async t => {
  const db = new PGlite();
  const previousFetch = neonConfig.fetchFunction;
  const previousProducts = seed.products;
  const names = ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'PRODUCT_BLOB_READ_WRITE_TOKEN'];
  const previousEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/npay-reservations';
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  seed.products = [{ id: 'bag-a', name: 'Fixture bag', model: 'A', image: 'https://example.invalid/bag.webp', price: 30000, stock: 1, options: [] }];
  const pgText = v => v === null ? null : v instanceof Date ? v.toISOString().replace('T', ' ').replace(/Z$/, '+00') : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'boolean' ? v ? 't' : 'f' : String(v);
  neonConfig.fetchFunction = async (_url, { body }) => {
    const { queries, query, params } = JSON.parse(body);
    const run = async (sql, text, values) => { const { fields, rows } = await sql.query(text, values); return { fields, rows: rows.map(r => fields.map(f => pgText(r[f.name]))) }; };
    try { return Response.json(queries ? { results: await db.transaction(async tx => {
      const out = []; for (const q of queries) out.push(await run(tx, q.query, q.params)); return out;
    }) } : await run(db, query, params)); }
    catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  const reset = async () => {
    await db.exec('TRUNCATE orders CASCADE; DELETE FROM npay_inventory_reservations; DELETE FROM npay_checkouts; DELETE FROM black_friday_campaign');
    await db.query("INSERT INTO black_friday_campaign(singleton,id,revision,enabled,starts_at,ends_at,items) VALUES(true,'campaign',1,true,now()-interval '1 hour',now()+interval '1 hour',$1::jsonb)",
      [JSON.stringify([{ productId: 'bag-a', optionId: '', offerId, price: 10000, quantity: 1 }])]);
  };
  const hold = async (campaign = 'campaign') => {
    // A future Npay checkout has no local order/customer fields.
    await db.query("INSERT INTO npay_checkouts(id,request_id,fingerprint) VALUES('fixture-checkout','fixture-request','fixture-fingerprint')");
    await db.query('INSERT INTO npay_inventory_reservations(id,checkout_id,product_id,option_id,quantity,held_quantity,campaign_id,offer_id,unit_price,regular_price,snapshot) VALUES($1,$2,\'bag-a\',\'\',1,1,$3,$4,10000,30000,$5::jsonb)',
      ['NPR-0123456789abcdef01234567', 'fixture-checkout', campaign, campaign ? offerId : null, JSON.stringify(seed.products[0])]);
  };
  try {
    await db.exec('CREATE TABLE users(id text PRIMARY KEY)');
    await ensureOrderSchema(); await ensureCouponSchema(); await ensureBlackFridaySchema();

    await t.test('public availability subtracts Npay holds without creating dummy customer orders', async () => {
      await reset(); await hold();
      assert.equal((await applyInventoryReservations(seed.products))[0].stock, 0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
    });
    await t.test('campaign remaining quantity includes Npay allocation', async () => {
      await reset(); await hold();
      const result = await readPublicBlackFriday({ prepareOrders: ensureOrderSchema });
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].remaining, 0);
    });
    await t.test('local campaign purchase cannot take the last Npay-reserved unit', async () => {
      await reset(); await hold();
      await assert.rejects(createOrder(null, fields([{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }])), { status: 409 });
      assert.equal((await db.query('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
    });
    await t.test('admin confirmation cannot take the last Npay-reserved ordinary unit', async () => {
      await reset();
      const { order } = await createOrder(null, fields([{ productId: 'bag-a', optionId: '', quantity: 1 }]));
      await hold(null);
      await assert.rejects(updateOrderByAdmin({ orderNumber: order.orderNumber, revision: order.revision, status: 'confirmed', trackingNumber: '' }), { status: 409 });
    });
    await t.test('reservation retries reuse one allocation and changed request contents conflict', async () => {
      await reset();
      const input = { requestId: randomUUID(), items: [{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }] };
      const first = await reserve(input);
      const replay = await reserve(input);
      assert.equal(replay.checkout.id, first.checkout.id);
      assert.equal(replay.duplicate, true);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_inventory_reservations')).rows[0].n, 1);
      await assert.rejects(reserve({ ...input, items: [{ ...input.items[0], quantity: 2 }] }), { status: 409 });
    });
    await t.test('two competing Npay registrations cannot allocate one campaign unit twice', async () => {
      await reset();
      const results = await Promise.allSettled([1, 2].map(() => reserve({ requestId: randomUUID(),
        items: [{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }] })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await db.query('SELECT sum(held_quantity)::int AS n FROM npay_inventory_reservations')).rows[0].n, 1);
    });
    await t.test('registration can be claimed once; uncertain and blocked checkouts never free stock or become claimable', async () => {
      await reset();
      const { checkout } = await reserve({ requestId: randomUUID(), items: [{ productId: 'bag-a', optionId: '', quantity: 1 }] });
      assert.equal(await reservations.claimNpayRegistration(checkout.id), true);
      assert.equal(await reservations.claimNpayRegistration(checkout.id), false);
      await reservations.recordNpayRegistrationOutcome(checkout.id, 'uncertain');
      await db.query("UPDATE npay_checkouts SET created_at=now()-interval '7 days' WHERE id=$1", [checkout.id]);
      assert.equal((await applyInventoryReservations(seed.products))[0].stock, 0);
      assert.equal(await reservations.claimNpayRegistration(checkout.id), false);
      await reservations.blockNpayCheckout(checkout.id);
      await assert.rejects(reservations.recordNpayRegistrationOutcome(checkout.id, 'registered'), { status: 409 });
      assert.equal((await applyInventoryReservations(seed.products))[0].stock, 0);
    });
    await t.test('reserved projection exposes only its locked price and retires closed or revised campaign identities', async () => {
      await reset();
      const { checkout, items } = await reserve({ requestId: randomUUID(), items: [{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }] });
      const campaign = await import('../api/_lib/black-friday.js').then(m => m.readBlackFriday());
      const context = { product: seed.products[0], campaign, catalogRevision: checkout.catalog_revision, phase: 'registered', availableStock: 1 };
      const product = reservations.projectNpayReservation(items[0], context);
      assert.equal(product.price, 10000);
      assert.equal(product.physicalProductId, 'bag-a');
      assert.match(product.id, /^[A-Za-z0-9!+\-/=_|]{1,30}$/);
      assert.equal(product.npaySaleStatus, 'ON_SALE');
      assert.equal(reservations.projectNpayReservation(items[0], { ...context, campaign: { ...campaign, enabled: false } }).npaySaleStatus, 'NOT_SALE');
      assert.equal(reservations.projectNpayReservation(items[0], { ...context, campaign: { ...campaign, revision: 2 } }).npaySaleStatus, 'NOT_SALE');
      assert.equal(reservations.projectNpayReservation(items[0], { ...context, catalogRevision: 2 }).npaySaleStatus, 'NOT_SALE');
      assert.equal(reservations.projectNpayReservation(items[0], { ...context, phase: 'blocked' }).npaySaleStatus, 'NOT_SALE');
    });
    await t.test('Npay product-info projects its own held unit without exposing an unallocated option or normal-price fallback', async () => {
      await reset();
      const { checkout, items } = await reserve({ requestId: randomUUID(), items: [{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }] });
      const response = () => fetchNpayProductInformation(new Request('https://example.invalid/api/npay/products?product[0][id]=' + items[0].id));
      let xml = await (await response()).text();
      assert.match(xml, /<basePrice>10000<\/basePrice>/);
      assert.match(xml, /<status>ON_SALE<\/status><stockQuantity>1<\/stockQuantity>/);
      assert.match(xml, /product.html\?id=bag-a/);
      await reservations.blockNpayCheckout(checkout.id);
      xml = await (await response()).text();
      assert.match(xml, /<status>NOT_SALE<\/status><stockQuantity>0<\/stockQuantity>/);
      assert.equal((await applyInventoryReservations(seed.products))[0].stock, 0);
    });
    await t.test('ordinary catalog IDs cannot collide with the reserved Npay identity namespace', async () => {
      await reset();
      const product = { ...seed.products[0], id: 'NPR-999999999999999999999999' };
      seed.products.push(product);
      try {
        const id = npayProductId(product);
        const response = await fetchNpayProductInformation(new Request('https://example.invalid/api/npay/products?product[0][id]=' + id));
        assert.match(await response.text(), /<basePrice>30000<\/basePrice>/);
        assert.notEqual(id, product.id);
      } finally { seed.products.pop(); }
    });
    await t.test('a mixed Npay allocation locks two sale prices and an ordinary price, with only the selected option', async () => {
      await reset();
      const offerB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      seed.products.push({ id: 'bag-b', name: 'Fixture options', model: 'B', image: 'https://example.invalid/b.webp',
        price: 50000, optionName: '색상', options: [{ id: 'blue', label: '블루', stock: 1 }, { id: 'red', label: '레드', stock: 1 }] },
      { id: 'bag-c', name: 'Fixture ordinary', model: 'C', image: 'https://example.invalid/c.webp', price: 40000, stock: 1 });
      try {
        await db.query("UPDATE black_friday_campaign SET items=items || $1::jsonb", [JSON.stringify([{ productId: 'bag-b', optionId: 'blue', offerId: offerB, price: 20000, quantity: 1 }])]);
        const result = await reserve({ requestId: randomUUID(), items: [
          { productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale },
          { productId: 'bag-b', optionId: 'blue', quantity: 1, blackFriday: { offerId: offerB, unitPrice: 20000 } },
          { productId: 'bag-c', optionId: '', quantity: 1 },
        ] });
        const prices = Object.fromEntries(result.items.map(r => [r.product_id, r.unit_price]));
        assert.deepEqual(prices, { 'bag-a': 10000, 'bag-b': 20000, 'bag-c': 40000 });
        const campaign = await import('../api/_lib/black-friday.js').then(m => m.readBlackFriday());
        const products = result.items.map(r => reservations.projectNpayReservation(r, { product: seed.products.find(p => p.id === r.product_id),
          campaign, catalogRevision: 1, phase: 'registered', availableStock: 1 }));
        assert.deepEqual(products.find(p => p.physicalProductId === 'bag-b').options.map(o => o.id), ['blue']);
        const xml = buildOrderXml({ config: { shopId: 'fixture', certiKey: 'fixture' }, backUrl: 'https://example.invalid/',
          items: products.map(product => ({ product, quantity: 1, option: product.options[0] })) });
        assert.match(xml, /<basePrice>10000<\/basePrice>/);
        assert.match(xml, /<basePrice>20000<\/basePrice>/);
        assert.match(xml, /<basePrice>40000<\/basePrice>/);
        assert.doesNotMatch(xml, /레드/);
        assert.equal((await db.query('SELECT sum(held_quantity)::int AS n FROM npay_inventory_reservations')).rows[0].n, 3);
      } finally { seed.products.splice(1); }
    });
    await t.test('a failing ordinary line rolls back the whole mixed Npay allocation', async () => {
      await reset();
      seed.products.push({ id: 'empty', name: 'Fixture empty', model: 'E', image: 'https://example.invalid/e.webp', price: 20000, stock: 0 });
      try {
        await assert.rejects(reserve({ requestId: randomUUID(), items: [
          { productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale },
          { productId: 'empty', optionId: '', quantity: 1 },
        ] }), { status: 409 });
        assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_checkouts')).rows[0].n, 0);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM npay_inventory_reservations')).rows[0].n, 0);
      } finally { seed.products.pop(); }
    });
    await t.test('concurrent exact replay allocates once and grants only one registration claim', async () => {
      await reset();
      const input = { requestId: randomUUID(), items: [{ productId: 'bag-a', optionId: '', quantity: 1, blackFriday: sale }] };
      const [a, b] = await Promise.all([reserve(input), reserve(input)]);
      assert.equal(a.checkout.id, b.checkout.id);
      assert.equal((await db.query('SELECT sum(held_quantity)::int AS n FROM npay_inventory_reservations')).rows[0].n, 1);
      const claims = await Promise.all([reservations.claimNpayRegistration(a.checkout.id), reservations.claimNpayRegistration(a.checkout.id)]);
      assert.equal(claims.filter(Boolean).length, 1);
    });
  } finally {
    neonConfig.fetchFunction = previousFetch; seed.products = previousProducts;
    for (const name of names) previousEnv[name] === undefined ? delete process.env[name] : process.env[name] = previousEnv[name];
    await db.close();
  }
});
