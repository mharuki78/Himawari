import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';
import { fetch as admin } from '../api/admin/products.js';
import { createSessionCookie } from '../api/_lib/auth.js';
import { createMemberSession, getMember } from '../api/_lib/member-auth.js';
import { ensureCustomerFeatureSchema, listPublishedReviews, publishedReviewCounts } from '../api/_lib/customer-features.js';

test('owner-only member actions revoke sessions, and review counts agree with the published product reviews', async () => {
  const db = new PGlite();
  const priorFetch = neonConfig.fetchFunction;
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@fixture.invalid/himawari';
  process.env.ADMIN_SESSION_SECRET = 'fixture-secret-for-the-admin-session-1234';
  process.env.ADMIN_PASSWORD_HASH = 'fixture-configured';
  process.env.MEMBER_SESSION_SECRET = 'fixture-secret-for-the-member-session-1234';
  process.env.ADMIN_STAFF_ACCOUNTS = JSON.stringify([{ id: 'viewer', role: 'viewer' }]);
  const serialize = value => value === null ? null
    : Array.isArray(value) ? `{${value.join(',')}}`
      : value instanceof Date ? value.toISOString()
        : typeof value === 'boolean' ? value ? 't' : 'f' : String(value);
  const run = async (executor, { query, params }) => {
    const { fields, rows } = await executor.query(query, params);
    return { fields, rows: rows.map(row => fields.map(field => serialize(row[field.name]))) };
  };
  neonConfig.fetchFunction = async (_url, { body }) => {
    const input = JSON.parse(body);
    try {
      if (!input.queries) return Response.json(await run(db, input));
      return Response.json({ results: await db.transaction(async tx => {
        const results = [];
        for (const query of input.queries) results.push(await run(tx, query));
        return results;
      }) });
    } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  try {
    await db.exec(`
      CREATE TABLE users (id text PRIMARY KEY, email text, display_name text, avatar_url text, status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz);
      CREATE TABLE oauth_accounts (user_id text, provider text, created_at timestamptz DEFAULT now());
      CREATE TABLE member_sessions (id text PRIMARY KEY, user_id text, token_hash text, expires_at timestamptz);
      INSERT INTO users (id, email, display_name) VALUES ('sample', 'member@example.invalid', '테스트 회원');
      INSERT INTO oauth_accounts (user_id, provider) VALUES ('sample', 'google');
    `);
    const endpoint = 'https://himawari.co.kr/api/admin/products?route=members';
    const request = new Request(endpoint);
    const owner = createSessionCookie(request).split(';')[0];
    const viewer = createSessionCookie(request, { id: 'viewer', role: 'viewer' }).split(';')[0];
    assert.equal((await admin(request)).status, 401);
    assert.equal((await admin(new Request(endpoint, { headers: { cookie: viewer } }))).status, 403);
    const found = await admin(new Request(endpoint + '&q=member%40example.invalid', { headers: { cookie: owner } }));
    assert.equal(found.status, 200);
    assert.match(found.headers.get('cache-control'), /no-store/);
    const [member] = (await found.json()).items;
    assert.deepEqual(member.providers, ['google']);
    assert.equal(member.status, 'active');
    const login = (await createMemberSession(request, member.id)).split(';')[0];
    const session = () => getMember(new Request(endpoint, { headers: { cookie: login } }));
    assert.equal((await session()).id, member.id);
    const patch = (status, expectedStatus, origin = 'https://himawari.co.kr') => admin(new Request(endpoint, {
      method: 'PATCH', headers: { cookie: owner, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ id: member.id, status, expectedStatus }),
    }));
    assert.equal((await patch('disabled', 'active', 'https://example.invalid')).status, 403);
    assert.equal((await patch('disabled', 'active')).status, 200);
    assert.equal(await session(), null);
    await assert.rejects(createMemberSession(request, member.id), { status: 403 });
    assert.equal((await patch('disabled', 'active')).status, 409);
    assert.equal((await patch('active', 'disabled')).status, 200);
    assert.equal(await session(), null, 'Old session stays revoked after reactivation');

    await ensureCustomerFeatureSchema();
    await db.exec(`INSERT INTO product_reviews (id, product_id, reviewer_name, rating, content, status, source, review_group_key) VALUES
      ('native','blue','test',5,'review','published','himawari',NULL),
      ('direct','blue','test',4,'review','published','naver','1088M'),
      ('family','mint','test',5,'review','published','coupang','1088M'),
      ('pending','mint','test',5,'review','pending','coupang','1088M'),
      ('set','set','test',5,'review','published','naver','1088M-SET')`);
    const products = [{ id: 'blue', name: '백팩 No.1088M 블루' }, { id: 'set', name: '백팩 No.1088M+체스트벨트 SET' }];
    assert.deepEqual(await publishedReviewCounts(products), { blue: 3, set: 1 });
    assert.equal((await listPublishedReviews('blue', 0, false, '1088M')).aggregate.count, 3);
  } finally {
    neonConfig.fetchFunction = priorFetch;
    await db.close();
  }
});
