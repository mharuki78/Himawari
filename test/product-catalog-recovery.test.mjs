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
let scenario = 0;

async function withBlobResponses(options, run) {
  const previousDispatcher = getGlobalDispatcher();
  const previousToken = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = `vercel_blob_rw_test_fake_token_${++scenario}`;
  const downloads = [];
  let catalogHeads = 0;
  let headRequests = 0;
  let liveAttempts = 0;
  try {
    agent.get('https://vercel.com').intercept({ path: /\/api\/blob\?url=/, method: 'GET' })
      .reply(({ path }) => {
        headRequests += 1;
        const pathname = new URL(path, 'https://vercel.com').searchParams.get('url');
        if (pathname === 'products/v1/catalog.json') catalogHeads += 1;
        if (options.metadataDeniedAfterFirst && pathname === 'products/v1/catalog.json' && catalogHeads > 1) {
          return { statusCode: 403, data: JSON.stringify({ error: { code: 'forbidden', message: 'Access denied' } }) };
        }
        if (options.snapshotMetadataDenied && pathname.includes('catalog-snapshots/')) {
          return { statusCode: 403, data: JSON.stringify({ error: { code: 'forbidden', message: 'Access denied' } }) };
        }
        return { statusCode: 200, data: JSON.stringify({
          pathname, url: `${blobOrigin}/${pathname}`, etag: options.secondVersion && catalogHeads > 1 ? '"next123"' : etag, uploadedAt: currentCatalog.updatedAt,
        }) };
      }).persist();
    if (!options.snapshotMetadataDenied) {
      agent.get(blobOrigin).intercept({ path: '/products/v1/catalog-snapshots/current123.json', method: 'GET' })
        .reply(() => {
          downloads.push('snapshot');
          return options.snapshotDenied === false
            ? { statusCode: 200, data: JSON.stringify(currentCatalog), responseOptions: { headers: { etag } } }
            : { statusCode: 403, data: 'Forbidden' };
        }).times(options.recover ? 2 : 1);
      if (options.secondVersion) {
        agent.get(blobOrigin).intercept({ path: '/products/v1/catalog-snapshots/next123.json', method: 'GET' })
          .reply(() => {
            downloads.push('next-snapshot');
            return { statusCode: 200, data: JSON.stringify({ ...currentCatalog, revision: 13, products: [{ ...currentCatalog.products[0], price: 78000 }] }) };
          });
      }
      if (options.snapshotDenied !== false) agent.get(blobOrigin).intercept({ path: /\/products\/v1\/catalog\.json\?/, method: 'GET' })
        .reply(({ path }) => {
          const url = new URL(path, blobOrigin);
          assert.equal(url.searchParams.get('version'), etag);
          downloads.push('catalog');
          const denied = options.liveDenied && (!options.recover || liveAttempts++ === 0);
          return {
            statusCode: denied ? 403 : 200,
            data: denied ? 'Forbidden' : JSON.stringify(currentCatalog),
            responseOptions: { headers: { etag: options.stale ? '"old123"' : etag } },
          };
        }).times(options.stale ? 5 : options.recover ? 2 : 1);
    }
    const result = await run({ downloads, agent });
    assert.equal(headRequests, options.heads || 2);
    return result;
  } finally {
    setGlobalDispatcher(previousDispatcher);
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

test('동일 ETag는 메타데이터만 재확인하고 본문 다운로드를 재사용하며 호출자 변경을 격리한다', async () => {
  await withBlobResponses({ snapshotDenied: false, heads: 3 }, async ({ downloads, agent }) => {
    const first = await readProductCatalog();
    first.catalog.products[0].price = 1;
    const second = await readProductCatalog();
    assert.equal(second.catalog.products[0].price, 76000);
    assert.deepEqual(downloads, ['snapshot']);
    agent.assertNoPendingInterceptors();
  });
});

test('동시에 들어온 같은 버전의 읽기는 본문 다운로드 한 번을 공유한다', async () => {
  await withBlobResponses({ snapshotDenied: false, heads: 6 }, async ({ downloads, agent }) => {
    const results = await Promise.all(Array.from({ length: 5 }, () => readProductCatalog()));
    assert.ok(results.every(r => r.persisted && r.catalog.revision === 12));
    assert.deepEqual(downloads, ['snapshot']);
    agent.assertNoPendingInterceptors();
  });
});

test('ETag가 바뀌면 캐시를 건너뛰고 변경된 최신 가격을 읽는다', async () => {
  await withBlobResponses({ snapshotDenied: false, heads: 4, secondVersion: true }, async ({ downloads, agent }) => {
    await readProductCatalog();
    const updated = await readProductCatalog();
    assert.equal(updated.etag, '"next123"');
    assert.equal(updated.catalog.revision, 13);
    assert.equal(updated.catalog.products[0].price, 78000);
    assert.deepEqual(downloads, ['snapshot', 'next-snapshot']);
    agent.assertNoPendingInterceptors();
  });
});

test('다운로드 실패는 캐시하지 않아 다음 요청에서 정상 복구할 수 있다', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  await withBlobResponses({ liveDenied: true, recover: true, heads: 4 }, async ({ downloads, agent }) => {
    await assert.rejects(readProductCatalog);
    const result = await readProductCatalog();
    assert.equal(result.persisted, true);
    assert.deepEqual(downloads, ['snapshot', 'catalog', 'snapshot', 'catalog']);
    agent.assertNoPendingInterceptors();
  });
});

test('캐시가 있어도 메타데이터 권한 확인 실패를 숨기지 않는다', async () => {
  await withBlobResponses({ snapshotDenied: false, heads: 3, metadataDeniedAfterFirst: true }, async ({ downloads, agent }) => {
    await readProductCatalog();
    await assert.rejects(readProductCatalog);
    assert.deepEqual(downloads, ['snapshot']);
    agent.assertNoPendingInterceptors();
  });
});
