import assert from 'node:assert/strict';
import test from 'node:test';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';

import { readProductCatalog } from '../api/_lib/products.js';
import { fetch as storefrontHandler } from '../api/storefront.js';

const etag = '"current123"';
const blobOrigin = 'https://test.public.blob.vercel-storage.com';
const currentCatalog = {
  revision: 12,
  updatedAt: '2026-10-19T00:00:00Z',
  products: [{ id: 'current-bag', name: '현재 가방', price: 76000, stock: 0 }],
};

async function withBlobResponses(options, run) {
  const previousDispatcher = getGlobalDispatcher();
  const previousToken = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  const previousFetch = globalThis.fetch;
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_fake_token';
  globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
  const downloads = [];
  try {
    agent.get('https://vercel.com').intercept({ path: /\/api\/blob\?url=/, method: 'GET' })
      .reply(({ path }) => {
        const pathname = new URL(path, 'https://vercel.com').searchParams.get('url');
        if (options.snapshotMetadataDenied && pathname.includes('catalog-snapshots/')) {
          return { statusCode: 403, data: JSON.stringify({ error: { code: 'forbidden', message: 'Access denied' } }) };
        }
        return { statusCode: 200, data: JSON.stringify({
          pathname, url: `${blobOrigin}/${pathname}`, etag, uploadedAt: currentCatalog.updatedAt,
        }) };
      }).times(2);
    if (!options.snapshotMetadataDenied) {
      agent.get(blobOrigin).intercept({ path: '/products/v1/catalog-snapshots/current123.json', method: 'GET' })
        .reply(() => {
          downloads.push('snapshot');
          return { statusCode: 403, data: 'Forbidden' };
        });
      agent.get(blobOrigin).intercept({ path: /\/products\/v1\/catalog\.json\?/, method: 'GET' })
        .reply(({ path }) => {
          const url = new URL(path, blobOrigin);
          assert.equal(url.searchParams.get('version'), etag);
          downloads.push('catalog');
          return {
            statusCode: options.liveDenied ? 403 : 200,
            data: options.liveDenied ? 'Forbidden' : JSON.stringify(currentCatalog),
            responseOptions: { headers: { etag: options.stale ? '"old123"' : etag } },
          };
        }).times(options.stale ? 5 : 1);
    }
    return await run({ downloads, agent });
  } finally {
    setGlobalDispatcher(previousDispatcher);
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
    else process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = previousToken;
    await agent.close();
  }
}

test('스냅샷 다운로드 403이면 ETag가 일치하는 최신 원본으로 복구한다', async (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  await withBlobResponses({}, async ({ downloads, agent }) => {
    const result = await readProductCatalog();
    assert.equal(result.persisted, true);
    assert.equal(result.etag, etag);
    assert.equal(result.catalog.revision, 12);
    assert.equal(result.catalog.products.length, 1);
    assert.equal(result.catalog.products[0].id, 'current-bag');
    assert.equal(result.catalog.products[0].price, 76000);
    assert.equal(result.catalog.products[0].stock, 0);
    assert.deepEqual(downloads, ['snapshot', 'catalog']);
    agent.assertNoPendingInterceptors();
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(warning.mock.calls[0].arguments, ['product_catalog_snapshot_unavailable', { upstreamStatus: 403 }]);
  });
});

test('스냅샷과 최신 원본이 모두 403이면 기본 상품으로 대체하지 않는다', async (t) => {
  t.mock.method(console, 'warn', () => {});
  await withBlobResponses({ liveDenied: true }, async ({ downloads, agent }) => {
    await assert.rejects(readProductCatalog, /Vercel Blob: Failed to fetch blob: 403\b/);
    assert.deepEqual(downloads, ['snapshot', 'catalog']);
    agent.assertNoPendingInterceptors();
  });
});

test('403 복구 중 원본 ETag가 최신 메타데이터와 다르면 오래된 가격을 반환하지 않는다', async (t) => {
  t.mock.method(console, 'warn', () => {});
  await withBlobResponses({ stale: true }, async ({ downloads, agent }) => {
    await assert.rejects(readProductCatalog, { status: 409 });
    assert.deepEqual(downloads, ['snapshot', ...Array(5).fill('catalog')]);
    agent.assertNoPendingInterceptors();
  });
});

test('스냅샷 메타데이터 권한 오류는 다운로드 대체 경로로 우회하지 않는다', async () => {
  await withBlobResponses({ snapshotMetadataDenied: true }, async ({ downloads, agent }) => {
    await assert.rejects(readProductCatalog);
    assert.deepEqual(downloads, []);
    agent.assertNoPendingInterceptors();
  });
});

test('Blob 접근 실패 상품 페이지는 500 응답을 공유 캐시에 저장하지 않는다', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  await withBlobResponses({ liveDenied: true }, async () => {
    const response = await storefrontHandler(new Request('https://himawari.co.kr/api/storefront?page=product&id=current-bag'));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /제품 페이지를 준비하지 못했습니다/);
  });
});
