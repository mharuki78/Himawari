import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { fetch as auth } from '../api/auth.js';
import { fetch as orders } from '../api/orders.js';
import { createOAuthStateCookie, getMember } from '../api/_lib/member-auth.js';
import { createOrder } from '../api/_lib/orders.js';
import { createPaymentService } from '../api/_lib/kakaopay.js';
import { blackFridayCatalogRows, readBlackFriday, saveBlackFriday } from '../api/_lib/black-friday.js';
import { seedCatalog, publicProduct } from '../api/_lib/products.js';
import { WELCOME_COUPON } from '../assets/welcome-coupon.js';
import { standardShippingFee } from '../assets/shipping-policy.js';

const origin = 'https://himawari.co.kr';

test('new OAuth signups receive one welcome coupon; bank and KakaoPay exclude the campaign option', async () => {
  const db = new PGlite();
  const previousFetch = globalThis.fetch;
  const previousNeon = neonConfig.fetchFunction;
  const names = ['DATABASE_URL','MEMBER_SESSION_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET',
    'KAKAOPAY_ENABLED','KAKAOPAY_SECRET_KEY','KAKAOPAY_CID','PRODUCT_BLOB_READ_WRITE_TOKEN','BLOB_READ_WRITE_TOKEN'];
  const previousEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://fixture:fixture@fixture.invalid/himawari', MEMBER_SESSION_SECRET: 'm'.repeat(40),
    GOOGLE_CLIENT_ID:'fixture-client', GOOGLE_CLIENT_SECRET:'fixture-secret',
    KAKAOPAY_ENABLED:'true', KAKAOPAY_SECRET_KEY:'fixture-key-'.repeat(3), KAKAOPAY_CID:'CT07417871',
  });
  delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const pgText = value => {
    if (value === null) return null;
    if (typeof value === 'boolean') return value ? 't' : 'f';
    if (value instanceof Date) return value.toISOString().replace('T', ' ').replace(/Z$/, '+00');
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
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
  let subject = '';
  globalThis.fetch = async url => {
    if (String(url) === 'https://oauth2.googleapis.com/token') return Response.json({access_token:'fixture-token'});
    if (String(url) === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return Response.json({sub:subject,email:subject+'@example.invalid',email_verified:true,name:'테스트 회원'});
    }
    throw new Error('Unexpected network request in checkout fixture');
  };
  const signIn = async (id, expectedStatus) => {
    subject = id;
    const { state, cookie } = createOAuthStateCookie(new Request(origin), { provider:'google',returnTo:'/' });
    const response = await auth(new Request(origin+'/api/auth?route=callback-google&code=fixture&state='+state, {
      headers:{cookie:cookie.split(';')[0]},
    }));
    assert.equal(new URL(response.headers.get('location')).searchParams.get('auth'), expectedStatus);
    const memberCookie = response.headers.getSetCookie().find(value=>value.startsWith('__Host-himawari_member=')).split(';')[0];
    const request = new Request(origin+'/api/orders?route=welcome-coupon',{headers:{cookie:memberCookie}});
    return { member:await getMember(request), wallet:await (await orders(request)).json() };
  };

  try {
    await db.exec(`
      CREATE TABLE users (id text PRIMARY KEY,email text,display_name text,avatar_url text,status text DEFAULT 'active',updated_at timestamptz DEFAULT now(),last_login_at timestamptz);
      CREATE TABLE oauth_accounts (provider text,provider_user_id text,user_id text REFERENCES users(id),email text,display_name text,avatar_url text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),PRIMARY KEY(provider,provider_user_id));
      CREATE TABLE member_sessions (id text PRIMARY KEY,user_id text REFERENCES users(id),token_hash text,expires_at timestamptz);
      INSERT INTO users(id) VALUES ('old-member');
      INSERT INTO oauth_accounts(provider,provider_user_id,user_id) VALUES ('google','existing','old-member');
    `);
    const catalog = blackFridayCatalogRows(seedCatalog().products.map(publicProduct));
    const available = catalog.filter(item => item.regularPrice > 10000 && (item.stock === null || item.stock >= 2));
    const normal = available.find(item => item.productId === 'store-13725149652') || available[0];
    const eventProduct = available.find(item => item.productId !== normal.productId);
    const sku = ({ productId, optionId }) => ({productId,optionId});
    const kst = ms => new Date(ms+9*3600_000).toISOString().slice(0,16);
    const offerPrice = Math.min(39000,eventProduct.regularPrice-1);
    await saveBlackFriday({ revision:0,enabled:true,startsAt:kst(Date.now()-3600_000),endsAt:kst(Date.now()+3600_000),
      items:[{...sku(eventProduct),price:offerPrice,quantity:2}] });
    const first = await signIn('new-bank', 'welcome');
    const second = await signIn('new-kakao', 'welcome');
    assert.deepEqual(first.wallet,{available:true,excluded:[sku(eventProduct)]});
    assert.equal((await signIn('new-bank', 'success')).member.id, first.member.id);
    const existing = await signIn('existing', 'success');
    assert.equal(existing.wallet.available,false);
    const request = (overrides={}) => ({
      requestId:randomUUID(),recipientName:'테스트 수령인',email:'order@example.invalid',phone:'010-0000-0000',
      postalCode:'00000',addressLine1:'테스트 배송 주소',termsConsent:true,privacyConsent:true,
      items:[{...sku(normal),quantity:1},{...sku(eventProduct),quantity:1}],
      couponId:WELCOME_COUPON.id,welcomeDiscountAmount:Math.floor(normal.regularPrice/10),...overrides,
    });
    const offer = (await readBlackFriday()).items[0];
    await assert.rejects(createOrder(first.member,request({items:[{...sku(eventProduct),quantity:1}],blackFriday:{offerId:offer.offerId,unitPrice:offerPrice}})), {status:409});
    await assert.rejects(createOrder(first.member,request({items:[{...sku(eventProduct),quantity:1}],welcomeDiscountAmount:0})), {status:409});
    await assert.rejects(createOrder(first.member,request({welcomeDiscountAmount:0})), {status:409});
    await assert.rejects(createOrder(existing.member,request()), {status:409});
    await assert.rejects(createOrder(null,request()), {status:401});
    const { order } = await createOrder(first.member,request());
    assert.equal(order.discountAmount, Math.floor(normal.regularPrice/10));
    assert.equal(order.total,normal.regularPrice+eventProduct.regularPrice-order.discountAmount+standardShippingFee(order.subtotal));
    await assert.rejects(createOrder(first.member,request()), {status:409});
    assert.equal((await signIn('new-bank','success')).wallet.available,false);
    let readyAmount;
    const payment = createPaymentService({ provider: async (action, data) => {
      assert.equal(action,'ready');
      readyAmount=data.total_amount;
      return {tid:'T'+'0'.repeat(19),next_redirect_pc_url:'https://online-pay.kakaopay.com/fixture',
        next_redirect_mobile_url:'https://online-pay.kakaopay.com/fixture'};
    } });
    const ready = await payment.ready(second.member,request());
    assert.equal(readyAmount,order.total);
    assert.equal(ready.total,order.total);
    const claims = await db.query('SELECT count(*)::int AS n FROM coupon_claims WHERE coupon_id=$1', [WELCOME_COUPON.id]);
    assert.equal(claims.rows[0].n,2);
  } finally {
    neonConfig.fetchFunction=previousNeon;
    globalThis.fetch=previousFetch;
    for (const [name,value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name]=value;
    }
    await db.close();
  }
});
