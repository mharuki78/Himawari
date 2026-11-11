import { test } from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import { publicProduct as normalizeProduct } from '../api/_lib/products.js';
import { exportProductCsv, planProductCsv, planBulkProducts } from '../api/_lib/product-csv.js';

const simple = normalizeProduct({ id: 'bag-0514', model: '0514', name: '실버, "미니"\n백팩', naverPrice: 118000, stock: null, naverDiscountRate: null, image: 'https://example.com/bag.webp', createdAt: '2026-01-01T00:00:00.000Z' });
const optioned = normalizeProduct({ ...simple, id: 'bag-1027', model: '1027', name: '컬러 백팩', naverPrice: 76000, optionName: '컬러', options: [{ id: 'mint-stable', label: '민트', stock: 12 }, { id: 'pink-stable', label: '핑크', stock: 8 }] });
const products = [simple, optioned];
const etag = '"catalog-v1"';
function editCsv(edit, catalog = products) {
  const parsed = Papa.parse(exportProductCsv(catalog, etag).replace(/^\ufeff/, ''));
  edit(parsed.data);
  return Papa.unparse(parsed.data, { newline: '\r\n' });
}

test('Excel CSV round trip keeps quoted multiline Korean names, unlimited stock, and stable option IDs', () => {
  const csv = exportProductCsv(products, etag);
  assert.ok(csv.startsWith('\ufeff'));
  const parsed = Papa.parse(csv.replace(/^\ufeff/, ''));
  assert.equal(parsed.data[1][2], simple.name);
  assert.deepEqual(parsed.data.slice(2).map((row) => row[3]), ['mint-stable', 'pink-stable']);
  const plan = planProductCsv(csv, products, etag);
  assert.equal(plan.updated, 0);
  assert.deepEqual(plan.products, products);
});

test('price, stock zero, discount and partial option rows update existing products without changing media', () => {
  const csv = editCsv((rows) => {
    rows[1][5] = '99,000'; rows[1][6] = '0'; rows[1][7] = '10';
    rows[2][6] = '3'; rows.splice(3, 1);
  });
  const plan = planProductCsv(csv, products, etag);
  assert.equal(plan.updated, 2);
  assert.equal(plan.products[0].price, 99000);
  assert.equal(plan.products[0].naverPrice, 99000);
  assert.equal(plan.products[0].stock, 0);
  assert.equal(plan.products[0].image, simple.image);
  assert.deepEqual(plan.products[1].options, [{ id: 'mint-stable', label: '민트', stock: 3 }, { id: 'pink-stable', label: '핑크', stock: 8 }]);
  assert.equal(plan.products[1].stock, 11);
  assert.equal(simple.stock, null);
  assert.equal(optioned.options[0].stock, 12);
});

test('reordering option rows and editing display labels does not reassign IDs or product names', () => {
  const plan = planProductCsv(editCsv((rows) => {
    rows.splice(1, 1); rows.splice(1, 2, rows[2], rows[1]);
    rows[1][2] = '표시 이름 수정'; rows[1][4] = '표시 옵션 수정'; rows[1][6] = '2';
  }), products, etag);
  const updated = plan.products[1];
  assert.equal(updated.name, optioned.name);
  assert.equal(updated.options[1].id, 'pink-stable');
  assert.equal(updated.options[1].stock, 2);
  assert.equal(updated.options[0].stock, 12);
  assert.equal(plan.changes[0].row, 2);
});

test('stale or mixed catalog versions are rejected even when the page has a fresh etag', () => {
  assert.throws(() => planProductCsv(exportProductCsv(products, etag), products, 'catalog-v2', 'catalog-v2'), { status: 409 });
  assert.throws(() => planProductCsv(editCsv((rows) => { rows[2][8] = 'another'; }), products, etag), { status: 409 });
});

test('invalid rows prevent the entire batch, with row-specific error messages', () => {
  for (const [column, value] of [[5, '12,34'], [5, '0'], [5, '10000001'], [6, '-2'], [6, '1.5'], [6, '100000'], [7, '100'], [7, '=5+5']]) {
    assert.throws(() => planProductCsv(editCsv((rows) => { rows[1][5] = '100000'; rows[2][column] = value; }), products, etag), (error) => error.status === 400 && Object.keys(error.fieldErrors).some((field) => field.includes('3행')));
  }
  assert.equal(products[0].naverPrice, 118000);
});

test('duplicate rows, unknown product or option IDs, blank option stock and inconsistent prices are rejected', () => {
  for (const mutate of [
    (rows) => rows.push([...rows[1]]),
    (rows) => { rows[1][0] = 'unknown'; },
    (rows) => { rows[2][3] = 'pink-from-another-product'; },
    (rows) => { rows[2][6] = ''; },
    (rows) => { rows[2][5] = '50000'; },
    (rows) => { rows[0][1] = rows[0][0]; },
    (rows) => { rows[1].pop(); },
  ]) assert.throws(() => planProductCsv(editCsv(mutate), products, etag), { status: 400 });
});

test('blank simple stock means unlimited, blank price keeps price and blank discount clears discount', () => {
  const catalog = [normalizeProduct({ ...simple, stock: 5, naverDiscountRate: 20 })];
  const plan = planProductCsv(editCsv((rows) => { rows[1][5] = ''; rows[1][6] = ''; rows[1][7] = ''; }, catalog), catalog, etag);
  assert.equal(plan.products[0].stock, null);
  assert.equal(plan.products[0].naverPrice, 118000);
  assert.equal(plan.products[0].naverDiscountRate, null);
});

test('legacy stock CSV remains supported, matching options by label instead of row index', () => {
  const csv = Papa.unparse([
    ['id', 'model', 'name', 'stock', 'optionName', 'options(label=stock|...)', 'naverDiscountRate'],
    [optioned.id, optioned.model, optioned.name, 5, '컬러', '핑크=2|민트=3', '10'],
  ]);
  const plan = planProductCsv(csv, products, etag, etag);
  assert.deepEqual(plan.products[1].options, [{ id: 'mint-stable', label: '민트', stock: 3 }, { id: 'pink-stable', label: '핑크', stock: 2 }]);
  assert.equal(plan.products[1].naverPrice, 76000);
  assert.throws(() => planProductCsv(csv, products, etag, 'old'), { status: 409 });
});

test('export neutralizes spreadsheet formula prefixes in untrusted display names', () => {
  for (const name of ['=HYPERLINK("https://example.com")', ' +SUM(1,2)', '-1\n+SUM(1)', '@SUM(1)', '\tunsafe']) {
    const csv = exportProductCsv([{ ...simple, name }], etag);
    const value = Papa.parse(csv.replace(/^\ufeff/, '')).data[1][2];
    assert.ok(value.startsWith("'"), value);
    assert.equal(planProductCsv(csv, [normalizeProduct({ ...simple, name })], etag).updated, 0);
  }
});

test('bulk API compatibility rejects duplicate products and option deletion', () => {
  assert.throws(() => planBulkProducts(products, [{ id: simple.id, stock: 1 }, { id: simple.id, stock: 2 }]), { status: 400 });
  assert.throws(() => planBulkProducts(products, [{ id: optioned.id, options: [] }]), { status: 400 });
});

test('malformed quotes, oversized and empty CSVs do not produce a catalog update', () => {
  for (const csv of ['', 'x'.repeat(2_000_001), '제품ID,판매가\r\n"unclosed']) assert.throws(() => planProductCsv(csv, products, etag), { status: 400 });
});
