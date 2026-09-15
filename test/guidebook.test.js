import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichGuidebookCatalog, matchGuidebookSpecs } from '../scripts/import-guidebook-specs.mjs';

test('guidebook matching separates sizes, sets and incomplete dimensions', () => {
  assert.equal(matchGuidebookSpecs({ model: 'No.124' }).dimensions, '29 × 40 × 16 cm');
  assert.equal(matchGuidebookSpecs({ model: 'No.124S' }).dimensions, '22 × 33 × 14 cm');
  assert.equal(matchGuidebookSpecs({ model: 'No.1240' }), null);
  assert.equal(matchGuidebookSpecs({ model: 'No.1884', id: 'store-13641866477' }).dimensions, '28 × 40 × 17 cm');
  assert.equal(matchGuidebookSpecs({ model: 'No.0514' }).dimensions, undefined);
  assert.match(matchGuidebookSpecs({ model: 'No.0422', name: 'No.0422+체스트벨트 SET' }).measurementNote, /체스트벨트는 포함하지 않습니다/);
  assert.match(matchGuidebookSpecs({ model: 'No.0422' }).laptopCompartment, /두께 미기재/);
});

test('guidebook import preserves prices, stock, unmatched products and existing specs', () => {
  const products = [{ id: 'a', model: 'No.0422', price: 76000, stock: 9, specs: { care: '기존 관리 안내', dimensions: '기존 실측' } }, { id: 'b', model: 'No.9001', price: 123 }];
  const result = enrichGuidebookCatalog(products);
  assert.equal(result.products[0].price, 76000);
  assert.equal(result.products[0].stock, 9);
  assert.equal(result.products[0].specs.care, '기존 관리 안내');
  assert.equal(result.products[0].specs.dimensions, '기존 실측');
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.products[1], products[1]);
  assert.equal(products[0].specs.material, undefined);
  assert.equal(enrichGuidebookCatalog(result.products).changed.length, 0);
});
