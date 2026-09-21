import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichCatalogSpecs } from '../scripts/import-catalog-specs-20260914.mjs';

const product = (model, overrides = {}) => ({ id: 'example', model, name: model, price: 89000, stock: 3, image: '/original.jpg', specs: { material: 'old' }, ...overrides });

test('latest source corrects specs without modifying commerce fields', () => {
  const before = product('No.0422');
  const after = enrichCatalogSpecs([before]).products[0];
  const { specs, ...rest } = after;
  const { specs: old, ...original } = before;
  assert.deepEqual(rest, original);
  assert.equal(specs.dimensions, '30 × 40 × 15 cm');
  assert.equal(specs.laptopCompartment, '가로 × 세로: 28 × 25.5 cm · 두께 미기재');
  assert.equal(specs.material, '겉감: 폴리에스터 / 안감: 폴리에스터');
  assert.equal(specs.warranty, '당사 문의');
  assert.equal(before.specs.material, 'old');
});

test('mini IDs, color-specific weights and unconfirmed M are handled separately', () => {
  const out = enrichCatalogSpecs([
    product('No.0514'), product('No.0514', { id: 'store-13326396058' }),
    product('No.0515', { name: '0515 실버' }), product('No.0515', { name: '0515 블랙' }),
    product('No.1884', { id: 'store-13641866477', specs: { dimensions: '28 × 40 × 17 cm' } }),
    product('No.1884'),
  ]).products;
  assert.equal(out[0].specs.dimensions, '30 × 43 × 15 cm');
  assert.equal(out[1].specs.dimensions, '27 × 36 × 14 cm');
  assert.equal(out[2].specs.weight, '750 g');
  assert.equal(out[3].specs.weight, '850 g');
  assert.equal(out[4].specs.dimensions, '28 × 40 × 17 cm');
  assert.equal(out[5].specs.dimensions, '30 × 45 × 20 cm');
});

test('missing lining and IP evidence are not invented; unknown products do not gain bag specs', () => {
  const out = enrichCatalogSpecs([product('No.9290'), product('체스트벨트'), product('OKTA1084M')]).products;
  assert.match(out[0].specs.material, /안감: 카탈로그 미기재/);
  assert.equal(out[0].specs.waterResistance, '생활방수 원단 사용');
  for (const p of out.slice(1)) {
    assert.equal(p.specs.waterResistance, undefined);
    assert.equal(p.specs.dimensions, undefined);
    assert.equal(p.specs.warranty, '당사 문의');
  }
});

test('re-running produces no additional changes and preserves older sourced measurements', () => {
  const first = enrichCatalogSpecs([product('No.1111', { specs: { capacity: '50 L' } })]).products;
  assert.equal(first[0].specs.capacity, '50 L');
  assert.match(first[0].specs.measurementNote, /기존 2026 제품 가이드북/);
  assert.deepEqual(enrichCatalogSpecs(first).changes, []);
});
