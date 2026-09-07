import assert from 'node:assert/strict';
import test from 'node:test';

import { filterAndSortFamilies, groupProductFamilies, productCategory } from '../assets/catalog-tools.js';
import { publicProduct, seedCatalog } from '../api/_lib/products.js';

const products = seedCatalog().products.map(publicProduct);

test('같은 모델의 색상·사이즈 제품은 주소를 유지한 채 하나의 제품군으로 묶는다', () => {
  const families = groupProductFamilies(products);
  const family1884 = families.find((family) => family.key === '1884');
  assert.ok(family1884);
  assert.equal(family1884.variants.length, 3);
  assert.equal(new Set(family1884.variants.map((product) => product.id)).size, 3);
});

test('제품군 검색·용도 필터·가격 정렬을 조합한다', () => {
  const families = groupProductFamilies(products);
  const business = filterAndSortFamilies(families, { query: '방수', category: 'business', sort: 'price-low' });
  assert.ok(business.length > 0);
  assert.ok(business.every((family) => productCategory(family.representative) === 'business'));
  assert.deepEqual(business.map((family) => family.minPrice), business.map((family) => family.minPrice).sort((a, b) => a - b));
});
