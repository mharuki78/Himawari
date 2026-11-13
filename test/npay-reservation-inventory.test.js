import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync, publicEncrypt, constants } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import seed from '../products.json' with { type: 'json' };
import { applyInventoryReservations } from '../api/_lib/inventory.js';
import { ensureOrderSchema, createOrder, updateOrderByAdmin } from '../api/_lib/orders.js';
import { ensureCouponSchema } from '../api/_lib/coupon-claims.js';
import { ensureBlackFridaySchema, readPublicBlackFriday } from '../api/_lib/black-friday.js';
import { fetchNpayProductInformation, fetchNpayOrder, fetchNpayConfig } from '../api/_lib/npay-handlers.js';
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
    await db.exec('TRUNCATE orders CASCADE; TRUNCATE npay_checkouts CASCADE; DELETE FROM black_friday_campaign');
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
    await t.test('reserved registration sends the locked sale price once and encrypts replayable provider keys', async () => {
      await reset();
      const registration = await import('../api/_lib/npay-registration.js').catch(() => ({}));
      assert.equal(typeof registration.registerReservedNpayCheckout, 'function', 'reservation-bound registration missing');
      const input = { requestId: randomUUID(), items: [{ productId:'bag-a',optionId:'',quantity:1,blackFriday:sale }] };
      let calls = 0;
      const options = { keySecret:Buffer.alloc(32,7).toString('base64'), config:{shopId:'fixture-shop',certiKey:'fixture-cert',orderRegistrationUrl:'https://test-api.pay.naver.com/o/customer/api/order/v20/register'},
        backUrl:'https://example.invalid/checkout.html', request:async (_url, init) => {
          calls++; assert.match(init.body, /<basePrice>10000<\/basePrice>/); assert.match(init.body, /<id>NPR-[0-9a-f]{24}<\/id>/);
          assert.match(init.body, /product.html\?id=bag-a/); assert.equal(init.redirect,'error');
          return new Response('SUCCESS:fixture_BUY_KEY:12345');
        } };
      const result = await registration.registerReservedNpayCheckout(input, options);
      assert.deepEqual(result, {key:'fixture_BUY_KEY',merchantNo:'12345'});
      assert.deepEqual(await registration.registerReservedNpayCheckout(input, options), result);
      assert.equal(calls,1);
      const raw = JSON.stringify((await db.query('SELECT * FROM npay_registration_results')).rows);
      assert.doesNotMatch(raw, /fixture_BUY_KEY|12345|fixture-cert/);
      assert.equal((await db.query('SELECT phase FROM npay_checkouts')).rows[0].phase,'registered');
      await assert.rejects(registration.registerReservedNpayCheckout({...input,items:[{...input.items[0],quantity:2}]},options),{status:409});
      assert.equal(calls,1);
    });
    await t.test('lost registration response cannot be retried upstream or release the held unit', async () => {
      await reset();
      const registration = await import('../api/_lib/npay-registration.js').catch(() => ({}));
      assert.equal(typeof registration.registerReservedNpayCheckout,'function');
      let calls=0;
      const input={requestId:randomUUID(),items:[{productId:'bag-a',optionId:'',quantity:1}]};
      const options={keySecret:Buffer.alloc(32,7).toString('base64'),config:{shopId:'fixture',certiKey:'fixture',orderRegistrationUrl:'https://test-api.pay.naver.com/o/customer/api/order/v20/register'},backUrl:'https://example.invalid/',request:async()=>{calls++;throw new Error('synthetic lost response');}};
      await assert.rejects(registration.registerReservedNpayCheckout(input,options),{status:502});
      await assert.rejects(registration.registerReservedNpayCheckout(input,options),{status:409});
      assert.equal(calls,1);
      assert.equal((await applyInventoryReservations(seed.products))[0].stock,0);
      assert.equal((await db.query('SELECT phase FROM npay_checkouts')).rows[0].phase,'uncertain');
    });
    await t.test('authenticated synchronization advances only after matching settlement; missing details preserve its cursor and stock', async () => {
      await reset();
      const worker=await import('../api/_lib/npay-sync.js').catch(()=>({}));
      assert.equal(typeof worker.runNpayOrderSync,'function','durable synchronization worker missing');
      const allocated=await reserve({requestId:randomUUID(),items:[{productId:'bag-a',optionId:'',quantity:1,blackFriday:sale}]});
      const productId=allocated.items[0].id;
      let missing=false;
      const now=new Date(),request=async(path)=>{
        if(path.includes('last-changed-statuses'))return{data:{count:1,lastChangeStatuses:[{productOrderId:'fixture-sync-order',orderId:'fixture-sync-parent',lastChangedDate:now.toISOString(),productOrderStatus:'PAYED'}]}};
        return{data:missing?[]:[{order:{orderId:'fixture-sync-parent',paymentDate:now.toISOString()},productOrder:{productOrderId:'fixture-sync-order',productId,productOrderStatus:'PAYED',initialQuantity:1,remainQuantity:1,unitPrice:10000,optionPrice:0},completedClaims:[]}]};
      };
      const first=await worker.runNpayOrderSync({environment:'sandbox',request,now});
      assert.equal(first.cursorAdvanced,true);
      assert.equal(first.bound,1);
      const before=(await db.query("SELECT through_at FROM npay_sync_state WHERE environment='sandbox'")).rows[0].through_at;
      missing=true;
      const second=await worker.runNpayOrderSync({environment:'sandbox',request,now:new Date(now.getTime()+1000)});
      assert.equal(second.cursorAdvanced,false);
      assert.equal(second.missing,1);
      assert.equal((await db.query("SELECT through_at FROM npay_sync_state WHERE environment='sandbox'")).rows[0].through_at.toISOString(),before.toISOString());
      assert.equal((await applyInventoryReservations(seed.products))[0].stock,0);
      assert.doesNotMatch(JSON.stringify(first),/fixture-sync|NPR-|buyer@/);
    });
    await t.test('private sandbox route registers campaign prices through reservations while public production stays closed', async () => {
      await reset();
      const settings={NPAY_PUBLIC_ENABLED:'false',NPAY_REVIEW_TOKEN:'fixture-review',NPAY_SHOP_ID:'fixture',NPAY_CERTI_KEY:'fixture',NPAY_BUTTON_KEY:'fixture',
        NPAY_ORDER_API_ENV:'sandbox',NPAY_ORDER_CLIENT_ID:'fixture',NPAY_ORDER_CLIENT_SECRET:'fixture',NPAY_ORDER_PROXY_URL:'fixture',NPAY_SYNC_SECRET:'fixture',NPAY_RESERVATION_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
      const before=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
      Object.assign(process.env,settings);
      try{
        const readiness=await import('../api/_lib/npay-readiness.js');
        await readiness.ensureNpayReadinessSchema();
        await db.query("INSERT INTO npay_integration_release(environment,sandbox_testing) VALUES('sandbox',true) ON CONFLICT(environment) DO UPDATE SET sandbox_testing=true");
        let calls=0;
        globalThis.fetch=async(_url,init)=>{calls++;assert.match(init.body,/<basePrice>10000<\/basePrice>/);return new Response('SUCCESS:route_KEY:12345');};
        const body={reviewToken:'fixture-review',requestId:randomUUID(),items:[{productId:'bag-a',optionId:'',quantity:1,blackFriday:sale}]};
        const request=()=>new Request('https://example.invalid/api/npay/order',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify(body)});
        const response=await fetchNpayOrder(request());
        assert.equal(response.status,200);assert.equal((await response.json()).key,'route_KEY');
        assert.equal((await fetchNpayOrder(request())).status,200);assert.equal(calls,1);
        process.env.NPAY_PUBLIC_ENABLED='true';
        assert.equal((await fetchNpayOrder(request())).status,503);
        assert.equal(calls,1);
      }finally{
        globalThis.fetch=oldFetch;
        for(const [key,value] of Object.entries(before))value===undefined?delete process.env[key]:process.env[key]=value;
      }
    });
    await t.test('one synchronization lease prevents concurrent empty polls from masking a reconciliation incident',async()=>{
      const worker=await import('../api/_lib/npay-sync.js');
      await db.exec('DELETE FROM npay_sync_state');
      let release,entered,calls=0;
      const blocked=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
      const request=async()=>{calls++;if(calls===1){entered();await blocked;}return{data:{count:0,lastChangeStatuses:[]}};};
      const first=worker.runNpayOrderSync({environment:'sandbox',request});
      await started;
      try{
        await assert.rejects(worker.runNpayOrderSync({environment:'sandbox',request}),{status:409});
        assert.equal(calls,1,'A concurrent worker must not query the provider');
      }finally{release();await first;}
    });
    await t.test('cutover never reopens legacy purchase paths while synchronization or credentials are unavailable',async()=>{
      await reset();
      const settings={NPAY_PUBLIC_ENABLED:'true',NPAY_SHOP_ID:'fixture',NPAY_CERTI_KEY:'fixture',NPAY_BUTTON_KEY:'fixture',NPAY_ENV:'production',NPAY_MANAGED_CHECKOUT_REQUIRED:'true'};
      const before=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
      Object.assign(process.env,settings);let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected registration');};
      try{
        const config=await (await fetchNpayConfig(new Request('https://example.invalid/api/npay/config'))).json();
        assert.equal(config.enabled,false);assert.equal(config.blackFriday.enabled,false);
        const order=await fetchNpayOrder(new Request('https://example.invalid/api/npay/order',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify({items:[{productId:'bag-a',optionId:'',quantity:1}]})}));
        assert.equal(order.status,503);assert.equal(calls,0);
        const xml=await (await fetchNpayProductInformation(new Request('https://example.invalid/api/npay/product-info?product[0][id]=bag-a'))).text();
        assert.match(xml,/<status>NOT_SALE<\/status><stockQuantity>0<\/stockQuantity>/);
      }finally{globalThis.fetch=oldFetch;for(const [key,value]of Object.entries(before))value===undefined?delete process.env[key]:process.env[key]=value;}
    });
    await t.test('encrypted private entry is preview-only, expiring and redeemable once without persisting its token',async()=>{
      const {redeemSandboxSession}=await import('../api/_lib/npay-sandbox-session.js');
      const pair=generateKeyPairSync('rsa',{modulusLength:2048});
      const encrypt=value=>publicEncrypt({key:pair.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(JSON.stringify(value))).toString('base64');
      const token='a'.repeat(64),nonce='b'.repeat(32);
      const settings={VERCEL_ENV:'preview',NPAY_ORDER_API_ENV:'sandbox',NPAY_PUBLIC_ENABLED:'false',
        NPAY_SANDBOX_CREDENTIAL_PRIVATE_KEY:pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),
        NPAY_SANDBOX_REVIEW_ENVELOPE:encrypt({type:'sandbox-review',token})};
      const before=Object.fromEntries(Object.keys(settings).map(k=>[k,process.env[k]]));Object.assign(process.env,settings);
      try{
        const ticket=encrypt({type:'sandbox-entry',token,nonce,expiresAt:Date.now()+600_000});
        const cookie=await redeemSandboxSession(ticket);
        assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/Max-Age=3600/);
        assert.equal(await redeemSandboxSession(ticket),null);
        assert.equal(await redeemSandboxSession(encrypt({type:'sandbox-entry',token,nonce:'c'.repeat(32),expiresAt:Date.now()-1})),null);
        const stored=JSON.stringify((await db.query('SELECT * FROM npay_sandbox_sessions')).rows);
        assert.doesNotMatch(stored,new RegExp(token));
        process.env.VERCEL_ENV='production';assert.equal(await redeemSandboxSession(ticket),null);
      }finally{for(const [key,value]of Object.entries(before))value===undefined?delete process.env[key]:process.env[key]=value;}
    });
  } finally {
    neonConfig.fetchFunction = previousFetch; seed.products = previousProducts;
    for (const name of names) previousEnv[name] === undefined ? delete process.env[name] : process.env[name] = previousEnv[name];
    await db.close();
  }
});
