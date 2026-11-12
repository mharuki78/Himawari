import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { publicProduct } from '../api/_lib/products.js';
import { createProductCsvSandbox } from './helpers/product-csv-sandbox.js';

test('authenticated CSV API previews without writes, applies one atomic catalog write, and rejects stale/invalid batches', async () => {
  const product = publicProduct({ id: 'csv-test-bag', model: 'No.TEST', name: '가격 재고 검증 백팩', naverPrice: 76000, stock: 10,
    image: 'https://example.com/bag.webp', url: 'https://smartstore.naver.com/baegot/products/123456789' });
  const sandbox = await createProductCsvSandbox([product]);
  try {
    const { handler, request } = sandbox;
    assert.equal((await handler(request('GET', undefined, { cookie: '' }))).status, 401);
    assert.equal((await handler(request('POST', { csv: '' }, { origin: 'https://other.invalid' }))).status, 403);
    assert.equal((await handler(request('POST', null))).status, 400);
    const exported = await (await handler(request())).json();
    assert.equal(exported.items[0].naverPrice, 76000);
    const records = Papa.parse(exported.csv.replace(/^\ufeff/, '')).data;
    records[1][5] = '69000'; records[1][6] = '0';
    const csv = Papa.unparse(records);
    const preview = await (await handler(request('POST', { csv }))).json();
    assert.equal(preview.updated, 1);
    assert.equal(preview.changes.length, 2);
    assert.equal(sandbox.state.writes, 0);
    const failed = await handler(request('PUT', { csv: csv.replace('69000', '-5'), etag: preview.etag }));
    assert.equal(failed.status, 400);
    assert.ok(Object.keys((await failed.json()).fieldErrors).length);
    assert.equal(sandbox.state.writes, 0);
    sandbox.state.raceNextWrite = true;
    assert.equal((await handler(request('PUT', { csv, etag: preview.etag }))).status, 409);
    assert.equal(sandbox.state.writes, 0);
    const applied = await handler(request('PUT', { csv, etag: preview.etag }));
    assert.equal(applied.status, 200, JSON.stringify(await applied.clone().json()));
    assert.equal((await applied.json()).updated, 1);
    assert.equal(sandbox.state.writes, 1);
    assert.equal(sandbox.products[0].price, 69000);
    assert.equal(sandbox.products[0].stock, 0);
    const publicResponse = await sandbox.publicHandler(new Request('https://csv-fixture.invalid/api/products'));
    const publicData = await publicResponse.json();
    assert.equal(publicData.products[0].price, 69000);
    assert.equal(publicData.products[0].soldOut, true);
    assert.equal((await handler(request('PUT', { csv, etag: preview.etag }))).status, 409);
    assert.equal((await handler(request('POST', { csv }))).status, 409);
    const fresh = await (await handler(request())).json();
    assert.equal((await (await handler(request('PUT', { csv: fresh.csv, etag: fresh.etag }))).json()).updated, 0);
    assert.equal(sandbox.state.writes, 1);
    await sandbox.db.query('CREATE TABLE IF NOT EXISTS inventory_reservations(product_id text, option_id text, quantity integer, active boolean)');
    await sandbox.db.query('INSERT INTO inventory_reservations(product_id, option_id, quantity, active) VALUES($1,$2,$3,$4)', [product.id, '', 2, true]);
    const restock = await (await handler(request())).json();
    const restockedCsv = restock.csv.replace('69000,0,', '69000,10,');
    assert.equal((await handler(request('PUT', { csv: restockedCsv, etag: restock.etag }))).status, 200);
    const reservedPublic = await (await sandbox.publicHandler(new Request('https://csv-fixture.invalid/api/products'))).json();
    assert.equal(reservedPublic.products[0].stock, 8);
    const rawExport = await (await handler(request())).json();
    assert.equal(rawExport.items[0].stock, 10, 'CSV must export registered stock, not stock after reservations');
    assert.equal((await (await handler(request('PUT', { csv: rawExport.csv, etag: rawExport.etag }))).json()).updated, 0);
    assert.equal(sandbox.state.writes, 2, 'Unchanged reserved stock CSV must not double-subtract reservations');
  } finally { await sandbox.close(); }
});

test('model search filters across pages and exported name changes preserve all commercial data', async () => {
  const products = Array.from({ length: 25 }, (_, i) => publicProduct({
    id: `name-test-${i}`, model: i < 23 ? 'No.1088M' : 'No.1027',
    name: `기존 상품명 ${i}`, naverPrice: 76000 + i, stock: 10 + i,
    image: 'https://example.com/bag.webp', url: `https://smartstore.naver.com/baegot/products/${100000000 + i}`,
  }));
  const sandbox = await createProductCsvSandbox(products);
  try {
    const get = async suffix => (await sandbox.handler(new Request(`https://csv-fixture.invalid/api/admin/products${suffix}`, { headers: { cookie: sandbox.cookie } }))).json();
    const first = await get('?q=1088m');
    assert.equal(first.total, 23);
    assert.equal(first.items.length, 20);
    assert.equal(first.hasMore, true);
    const second = await get(`?q=1088m&cursor=${first.nextCursor}`);
    assert.equal(second.items.length, 3);
    assert.equal(second.hasMore, false);
    const exported = await get('?route=bulk-products&q=1088m');
    assert.equal(exported.items.length, 23, 'export includes matches beyond the visible page');
    const records = Papa.parse(exported.csv.replace(/^\ufeff/, '')).data;
    for (const row of records.slice(1)) row[2] = '히마와리 경량 학생백팩 No.1088M';
    const csv = Papa.unparse(records);
    const preview = await (await sandbox.handler(sandbox.request('POST', { csv }))).json();
    assert.equal(preview.updated, 23);
    assert.equal(sandbox.state.writes, 0);
    assert.ok(preview.changes.every(change => change.field === '제품명'));
    const applied = await sandbox.handler(sandbox.request('PUT', { csv, etag: preview.etag }));
    assert.equal(applied.status, 200);
    assert.equal(sandbox.state.writes, 1);
    for (const [i, product] of sandbox.products.entries()) {
      assert.equal(product.name, i < 23 ? '히마와리 경량 학생백팩 No.1088M' : products[i].name);
      assert.equal(product.naverPrice, products[i].naverPrice);
      assert.equal(product.stock, products[i].stock);
      assert.equal(product.image, products[i].image);
    }
    const publicData = await (await sandbox.publicHandler(new Request('https://csv-fixture.invalid/api/products'))).json();
    assert.equal(publicData.products.find(product => product.id === 'name-test-0').name, '히마와리 경량 학생백팩 No.1088M');
  } finally { await sandbox.close(); }
});
