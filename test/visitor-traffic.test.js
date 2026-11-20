import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { visitorDay, visitorPage } from '../assets/visitor-pages.js';
import { fetchVisitorTraffic, fetchVisitorView, readVisitorTraffic, recordVisitorView, validateVisitorView, VISITOR_SCHEMA } from '../api/_lib/visitor-traffic.js';

test('visitor analytics recognizes public pages and excludes private and checkout routes', () => {
  assert.equal(visitorPage('/index.html'), '/');
  assert.equal(visitorPage('/lookbook/index.html'), '/lookbook/');
  assert.equal(visitorPage('/black-friday/item/offer-123/'), '/black-friday/item/');
  assert.equal(visitorPage('/story/laptop-pouch-quilting-cushioning-evidence.html'), '/story/laptop-pouch-quilting-cushioning-evidence.html');
  for (const route of ['/admin/traffic.html', '/story/admin.html', '/checkout.html', '/account.html', '/support.html', '/npay-review-product.html']) {
    assert.equal(visitorPage(route), null);
  }
  assert.equal(validateVisitorView({ page: '/story/unknown-post.html', newVisitor: true, productId: '' }), null);
  assert.equal(validateVisitorView({ page: '/?email=private', newVisitor: true, productId: '' }), null);
  assert.equal(validateVisitorView({ page: '/', newVisitor: true, productId: 'unexpected' }), null);
  assert.equal(validateVisitorView({ page: '/product.html', newVisitor: true, productId: '' }), null);
  assert.deepEqual(validateVisitorView({ page: '/', newVisitor: true, productId: '', other: 'ignored' }), { page: '/', newVisitor: true, productId: '' });
});

test('visitor analytics uses Seoul midnight and rejects unauthorized requests before looking up data', async () => {
  assert.equal(visitorDay(Date.parse('2026-11-20T14:59:59Z')), '2026-11-20');
  assert.equal(visitorDay(Date.parse('2026-11-20T15:00:00Z')), '2026-11-21');
  const url = 'https://himawari.co.kr/api/visitor-view';
  assert.equal((await fetchVisitorView(new Request(url))).status, 405);
  assert.equal((await fetchVisitorView(new Request(url, { method: 'POST', headers: { Origin: 'https://other.test' } }))).status, 403);
  const env = { hash: process.env.ADMIN_PASSWORD_HASH, secret: process.env.ADMIN_SESSION_SECRET };
  process.env.ADMIN_PASSWORD_HASH = 'test-hash';
  process.env.ADMIN_SESSION_SECRET = 'test-not-an-operational-secret'.repeat(2);
  try {
    const result = await fetchVisitorTraffic(new Request('https://himawari.co.kr/api/admin/visitor-traffic'));
    assert.equal(result.status, 401);
    assert.match(result.headers.get('cache-control'), /no-store/);
  } finally {
    if (env.hash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = env.hash;
    if (env.secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = env.secret;
  }
});

test('visitor analytics aggregates date, page, and product counts without event records', async () => {
  const db = new PGlite();
  const sql = { query: async (query, params) => (await db.query(query, params)).rows };
  try {
    await db.exec(VISITOR_SCHEMA);
    const record = (day, page, productId, newVisitor) => recordVisitorView(sql, day, { page, productId, newVisitor });
    await record('2026-11-20', '/', '', true);
    await Promise.all([
      record('2026-11-20', '/product.html', 'bag-1', false),
      record('2026-11-20', '/product.html', 'bag-1', false),
      record('2026-11-20', '/black-friday/item/', 'bag-1', true),
      record('2026-11-20', '/product.html', 'bag-2', false),
    ]);
    await record('2026-11-21', '/', '', true);
    const report = await readVisitorTraffic(sql, 3, Date.parse('2026-11-21T01:00:00Z'));
    assert.deepEqual(report.daily, [
      { day: '2026-11-19', visits: 0, views: 0, productViews: 0 },
      { day: '2026-11-20', visits: 2, views: 5, productViews: 4 },
      { day: '2026-11-21', visits: 1, views: 1, productViews: 0 },
    ]);
    assert.deepEqual(report.pages[0], { page: '/product.html', views: 3 });
    assert.deepEqual(report.products, [{ id: 'bag-1', views: 3 }, { id: 'bag-2', views: 1 }]);
    const today = await readVisitorTraffic(sql, 1, Date.parse('2026-11-21T01:00:00Z'));
    assert.deepEqual(today.pages, [{ page: '/', views: 1 }]);
    assert.deepEqual(today.products, []);
  } finally {
    await db.close();
  }
});
