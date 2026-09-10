import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, parseCoupangProduct, planCoupangImport } from '../scripts/lib/coupang-catalog.js';
import { publicProduct, validateProductUpdateInput, seedCatalog } from '../api/_lib/products.js';
import { groupProductFamilies } from '../assets/catalog-tools.js';

const row = { name: '히마와리 노트북 백팩 No.124, 오렌지, 1개 할인 3% 57,400원 55,670원 (1개당 55,670원)', price: 55670155670, url: 'https://www.coupang.com/vp/products/1234', image: 'https://thumbnail1.coupangcdn.com/image/test.jpg' };
test('쿠팡 수집 가격에서 정상 판매가를 복원하고 판촉 문구를 제거한다', () => {
  const parsed = parseCoupangProduct(row);
  assert.equal(parsed.price, 55670);
  assert.equal(parsed.name, '히마와리 노트북 백팩 No.124, 오렌지');
  assert.throws(() => parseCoupangProduct({ ...row, price: 12345678910 }));
});
test('모델 별칭과 미니·M·세트를 구별한다', () => {
  assert.deepEqual(identity('No.H1084 라이트 그레이'), identity('No.1084H 라이트그레이'));
  assert.equal(identity('No.0514 Mini').model, '0514MINI');
  assert.equal(identity('No.0514 실버미니').model, '0514MINI');
  assert.notEqual(identity('No.1884 블랙M').model, identity('No.1884 블랙').model);
  assert.equal(identity('No.1027+체스트벨트 SET').model, '1027-SET');
});
test('기존 상품 우선, 파일 중복 제거, 반복 가져오기 무변경', () => {
  const existing = [{ id: 'old', name: 'No.124 오렌지', price: 99999 }];
  assert.equal(planCoupangImport([row], existing).additions.length, 0);
  const plan = planCoupangImport([row, row], []);
  assert.equal(plan.additions.length, 1);
  assert.equal(planCoupangImport([row], plan.additions).additions.length, 0);
  assert.equal(existing[0].price, 99999);
  assert.ok(plan.additions[0].id.length <= 30);
});
test('사진이나 가격이 다른 동일 상품은 확인 대기로 둔다', () => {
  const plan = planCoupangImport([row, { ...row, price: 57400 }], []);
  assert.equal(plan.additions.length, 0);
  assert.equal(plan.pending.length, 2);
});
test('쿠팡 상품도 기존 관리자에서 수정할 수 있다', () => {
  const product = publicProduct(planCoupangImport([row], []).additions[0]);
  assert.equal(validateProductUpdateInput(product, product).valid, true);
  assert.equal(validateProductUpdateInput({ ...product, url: 'https://www.coupang.com.evil.test/vp/products/1234' }, product).valid, false);
});
test('저렴한 쿠팡 색상을 추가해도 기존 대표 상품을 유지한다', () => {
  const original = { ...seedCatalog().products[0], model: 'No.124', featured: false };
  const added = planCoupangImport([row], []).additions[0];
  assert.equal(groupProductFamilies([original, added])[0].representative.id, original.id);
});
