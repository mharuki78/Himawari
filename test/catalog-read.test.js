import assert from 'node:assert/strict';
import test from 'node:test';
// The installed Blob SDK uses this same dispatcher for its HTTP requests.
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { readProductCatalog } from '../api/_lib/products.js';

test('public catalog reads keep management credentials on the metadata API', async () => {
  const previousToken = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  const previousDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_fake_token';
  const host = 'https://test.public.blob.vercel-storage.com';
  const etag = '"abc123"';
  const blobApi = agent.get('https://vercel.com');
  blobApi.intercept({ path: /\?url=/, method: 'GET' }).reply(({ path, headers }) => {
    assert.ok(new Headers(headers).get('authorization'), 'Metadata must remain authenticated');
    const pathname = new URL(path, 'https://vercel.com').searchParams.get('url');
    return { statusCode: 200, data: JSON.stringify({ url: host + '/' + pathname, pathname, etag, uploadedAt: '2026-10-19T00:00:00Z' }) };
  }).times(2);
  agent.get(host).intercept({ path: '/products/v1/catalog-snapshots/abc123.json', method: 'GET' }).reply(({ headers }) => {
    const authenticated = new Headers(headers).has('authorization');
    return {
      statusCode: authenticated ? 403 : 200,
      data: authenticated ? 'Public read does not require management credentials' : JSON.stringify({ revision: 12, updatedAt: '2026-10-19T00:00:00Z', products: [{ id: 'current-bag', name: '현재 가방', price: 76000, stock: 0 }] }),
      responseOptions: { headers: { etag } },
    };
  });
  try {
    const result = await readProductCatalog();
    assert.equal(result.persisted, true);
    assert.equal(result.etag, '"abc123"');
    assert.equal(result.catalog.revision, 12);
    assert.equal(result.catalog.products[0].id, 'current-bag');
    assert.equal(result.catalog.products[0].price, 76000);
    assert.equal(result.catalog.products[0].soldOut, true);
  } finally {
    setGlobalDispatcher(previousDispatcher);
    await agent.close();
    if (previousToken === undefined) delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
    else process.env.PRODUCT_BLOB_READ_WRITE_TOKEN = previousToken;
  }
});
