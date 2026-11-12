import test from 'node:test';
import assert from 'node:assert/strict';
import { blackFridayView } from '../black-friday/view.js';
import { createProductCsvSandbox } from './helpers/product-csv-sandbox.js';
import { classifyBlackFridayBannerPath } from '../api/_lib/black-friday-banner.js';

const requestId = 'e161d399-83b8-4795-9650-c35549120eca';
const pathname = `black-friday-banners/${requestId}/banner-random.png`;
const banner = { requestId, url: `https://fixture.public.blob.vercel-storage.com/${pathname}`, alt: '블랙 프라이데이 행사 안내', width: 1600, height: 600 };
const open = { state: 'open', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', serverTime: '2026-11-12T00:00:00Z', items: [], banner };

test('banner tokens use an isolated UUID scope and image filename', () => {
  assert.equal(classifyBlackFridayBannerPath(pathname, requestId), 'black-friday-banner');
  for (const path of [pathname.replace(requestId, 'another-owner'), pathname.replace('banner-', 'main-'), pathname + '.html', pathname.replace('black-friday-banners', 'product-media')]) assert.equal(classifyBlackFridayBannerPath(path, requestId), '');
});

test('collection banner appears above the intro, with its original ratio; closed or detail pages omit it', () => {
  const view = blackFridayView(open);
  assert.ok(view.content.includes(banner.url));
  assert.ok(view.content.indexOf(banner.url) < view.content.indexOf('bf-event__intro'));
  assert.match(view.content, /width="1600" height="600"/);
  assert.match(view.content, /alt="블랙 프라이데이 행사 안내"/);
  for (const state of ['inactive', 'scheduled', 'closed', 'error']) assert.ok(!blackFridayView({ ...open, state }).content.includes(banner.url));
  assert.ok(!blackFridayView(open, requestId).content.includes(banner.url));
  assert.ok(!blackFridayView({ ...open, serverTime: open.endsAt }).content.includes(banner.url));
  assert.ok(!blackFridayView({ ...open, banner: { ...banner, url: 'javascript:alert(1)' } }).content.includes('javascript:'));
  assert.ok(!blackFridayView({ ...open, banner: { ...banner, alt: '"><script>alert(1)</script>' } }).content.includes('<script>alert'));
});

test('authenticated banner saves migrate a legacy row, preserve offers and support replacement, removal and old clients', async () => {
  const sandbox = await createProductCsvSandbox();
  try {
    await sandbox.db.exec('CREATE TABLE users (id text PRIMARY KEY)');
    // Legacy schema without a banner column must remain readable and migrate additively.
    await sandbox.db.exec('CREATE TABLE black_friday_campaign (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), id text NOT NULL, revision integer NOT NULL, enabled boolean NOT NULL, starts_at timestamptz, ends_at timestamptz, items jsonb NOT NULL)');
    const call = (method, input) => sandbox.handler(new Request(sandbox.request(method, input).url.replace('bulk-products', 'black-friday'), sandbox.request(method, input)));
    const product = sandbox.products.find(p => p.price > 2);
    const option = product.options?.[0]?.id || '';
    const input = { revision: 0, enabled: true, startsAt: '2026-11-12T00:00', endsAt: '2026-12-01T00:00', items: [{ productId: product.id, optionId: option, price: 1, quantity: 2 }] };
    const created = await call('PUT', input);
    assert.equal(created.status, 200);
    const { config: initial } = await created.json();
    const fixture = { etag: 'banner-1', contentType: 'image/png', size: 1024 };
    sandbox.state.blobs.set(pathname, fixture);
    const saved = await call('PUT', { ...input, revision: initial.revision, banner });
    assert.equal(saved.status, 200);
    const { config } = await saved.json();
    assert.deepEqual(config.banner, banner);
    assert.equal(config.id, initial.id);
    assert.deepEqual(config.items, initial.items);
    assert.equal(config.startsAt, initial.startsAt);
    assert.equal(config.endsAt, initial.endsAt);
    assert.equal((await (await call('GET')).json()).config.banner.url, banner.url);
    const publicResponse = await sandbox.publicHandler(new Request('https://csv-fixture.invalid/api/products?route=black-friday'));
    const event = await publicResponse.json();
    assert.equal(event.banner.url, banner.url);
    assert.equal(event.banner.requestId, undefined);
    const oldClient = await call('PUT', { ...input, revision: config.revision });
    const previous = (await oldClient.json()).config;
    assert.deepEqual(previous.banner, banner);
    const replacementPath = pathname.replace('banner-random', 'banner-second');
    sandbox.state.blobs.set(replacementPath, fixture);
    const replacement = { ...banner, url: banner.url.replace(pathname, replacementPath), alt: '새 행사 안내' };
    const changed = await call('PUT', { ...input, revision: previous.revision, banner: replacement });
    assert.deepEqual((await changed.json()).config.banner, replacement);
    const stale = await call('PUT', { ...input, revision: previous.revision, banner: null });
    assert.equal(stale.status, 409);
    const removed = await call('PUT', { ...input, revision: previous.revision + 1, banner: null });
    assert.equal((await removed.json()).config.banner, null);
    const disabled = await call('PUT', { ...input, enabled: false, revision: previous.revision + 2, banner });
    assert.equal(disabled.status, 200);
    const inactive = await sandbox.publicHandler(new Request('https://csv-fixture.invalid/api/products?route=black-friday'));
    assert.equal((await inactive.json()).banner, null);
    assert.equal(sandbox.state.writes, 0, 'campaign banner changes do not write the product catalog');
    assert.ok(sandbox.state.blobs.has(pathname), 'saved image assets are retained to protect concurrent readers and uncertain saves');
  } finally { await sandbox.close(); }
});

test('banner persistence rejects foreign paths, missing files, non-images and oversized files', async () => {
  const sandbox = await createProductCsvSandbox();
  try {
    await sandbox.db.exec('CREATE TABLE users (id text PRIMARY KEY)');
    const call = input => sandbox.handler(new Request(sandbox.request('PUT', input).url.replace('bulk-products', 'black-friday'), sandbox.request('PUT', input)));
    const input = { revision: 0, enabled: false, items: [] };
    for (const candidate of [
      { ...banner, url: 'https://example.com/banner.png' },
      { ...banner, requestId: 'wrong-owner' },
      { ...banner, url: banner.url.replace('/banner-', '/main-') },
      banner,
    ]) assert.equal((await call({ ...input, banner: candidate })).status, 400);
    for (const fixture of [ { contentType: 'text/html', size: 30 }, { contentType: 'image/png', size: 8 * 1024 * 1024 + 1 } ]) {
      sandbox.state.blobs.set(pathname, fixture);
      assert.equal((await call({ ...input, banner })).status, 400);
    }
  } finally { await sandbox.close(); }
});
