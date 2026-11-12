import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAdminProducts } from '../api/_lib/admin-product-search.js';
import { productColor, productVariantLabel } from '../assets/catalog-tools.js';

const products = [
  { id: 'naver-1', model: 'No.0514', name: '히마와리 0514Mini 실버', options: [] },
  { id: 'coupang-2', model: 'No.1088M', name: '히마와리 학생백팩 체스트벨트 SET', options: [{ label: '민트' }] },
  { id: 'naver-3', model: 'No.0514', name: '히마와리 0514 블랙', options: [] },
];
test('admin search matches model, exact size suffix, names, IDs and option labels before pagination', () => {
  assert.deepEqual(filterAdminProducts(products, ' no.1088m '), [products[1]]);
  assert.deepEqual(filterAdminProducts(products, '0514mini'), [products[0]]);
  assert.deepEqual(filterAdminProducts(products, '1088M 민트'), [products[1]]);
  assert.deepEqual(filterAdminProducts(products, 'coupang-2'), [products[1]]);
  assert.deepEqual(filterAdminProducts(products, '없는품번'), []);
  assert.deepEqual(filterAdminProducts(products, ''), products);
});
test('shared Naver titles retain colour labels from existing imported variant metadata', () => {
  const variant = { model: 'No.1682', name: '히마와리 남성 대용량 데일리 여행백팩 No.1682', tagline: 'No.1682 · 카키 네모백 롤업 멀티 수납' };
  assert.equal(productColor(variant), '카키');
  assert.equal(productVariantLabel(variant), '카키');
  assert.equal(productColor({ ...variant, name: variant.name + ' 블랙' }), '블랙', 'actual title takes precedence over old tagline');
});
