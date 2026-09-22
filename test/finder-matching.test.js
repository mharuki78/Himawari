import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingProducts, isFinderPurchasable, laptopMeasurements } from '../assets/finder-matching.js';

const answers = { purpose: 'business', storage: 'any', budget: '80000', priority: 'design' };
const bag = (id, overrides = {}) => ({ id, model: `No.${id}`, name: `출근 노트북 백팩 No.${id}`, price: 60000, stock: 3, options: [], specs: { laptopCompartment: '가로 × 세로: 28 × 37 cm · 두께 미기재', weight: '800 g', waterResistance: '생활방수 원단 사용' }, ...overrides });

test('a stronger preference never admits over-budget or unavailable products', () => {
  const result = findMatchingProducts([
    bag('1001', { price: 80001 }), bag('1002', { soldOut: true }), bag('1003', { stock: 0 }),
    bag('1004', { options: [{ stock: 0 }], stock: null }), bag('1005', { price: 80000 }),
  ], { ...answers, priority: 'waterproof' });
  assert.deepEqual(result.items.map(x => x.product.id), ['1005']);
  assert.equal(result.excluded.unavailable, 3);
  assert.equal(result.excluded.budget, 1);
});

test('chooses a purchasable affordable variant instead of the unavailable family representative', () => {
  const result = findMatchingProducts([bag('1001-red', { model: 'No.1001', soldOut: true, featured: true }), bag('1001-blue', { model: 'No.1001' }), bag('1001-pink', { model: 'No.1001', price: 90000 })], answers);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].product.id, '1001-blue');
  assert.equal(result.items[0].variantCount, 1);
});

test('laptop recommendations require internal measurements, not a name or external dimensions', () => {
  const result = findMatchingProducts([
    bag('1001', { specs: { dimensions: '30 × 45 × 20 cm', laptopCompartment: '포켓 있음 · 치수 미기재' } }),
    bag('1002', { specs: { laptopCompartment: '15인치 노트북' } }), bag('1003'),
  ], answers);
  assert.deepEqual(result.items.map(x => x.product.id), ['1003']);
  assert.match(result.items[0].check, /두께는 미기재/);
  assert.match(result.items[0].check, /수납을 보장하지 않습니다/);
  assert.equal(result.items[0].reasons.length, 2);
  assert.equal(laptopMeasurements('외부 크기 30 × 45 cm'), null);
  assert.equal(laptopMeasurements('추정 30 × 45 cm'), null);
});

test('lightweight preference ranks measured grams, never marketing copy', () => {
  const result = findMatchingProducts([
    bag('1001', { name: '초경량 출근 백팩 No.1001', specs: { laptopCompartment: '28 × 37 cm', weight: '1300 g' } }),
    bag('1002', { specs: { laptopCompartment: '28 × 37 cm', weight: '0.6 kg' } }),
    bag('1003', { specs: { laptopCompartment: '28 × 37 cm', weight: '미확인' } }),
  ], { ...answers, priority: 'light' });
  assert.deepEqual(result.items.map(x => x.product.id), ['1002', '1001']);
  assert.ok(result.items[0].reasons.includes('등록 무게 600 g'));
});

test('capacity comparison excludes missing data and reports fewer than three honestly', () => {
  const result = findMatchingProducts([bag('1001'), bag('1002', { specs: { laptopCompartment: '28 × 37 cm', capacity: '20 L' } })], { ...answers, storage: 'roomy' });
  assert.equal(result.items.length, 1);
  assert.equal(result.excluded.specifications, 1);
  assert.equal(findMatchingProducts([bag('1001')], { ...answers, storage: 'roomy' }).items.length, 0);
});

test('water resistance must be explicitly registered and not negated', () => {
  const result = findMatchingProducts([bag('1001', { name: '방수 출근 노트북', specs: { laptopCompartment: '28 × 37 cm' } }), bag('1002', { specs: { laptopCompartment: '28 × 37 cm', waterResistance: '방수 아님' } }), bag('1003')], { ...answers, priority: 'waterproof' });
  assert.deepEqual(result.items.map(x => x.product.id), ['1003']);
});

test('unlimited inventory follows storefront semantics, invalid prices and all-sold-out options do not', () => {
  assert.equal(isFinderPurchasable(bag('1001', { stock: null })), true);
  assert.equal(isFinderPurchasable(bag('1001', { price: NaN })), false);
  assert.equal(isFinderPurchasable(bag('1001', { stock: null, options: [{ stock: 0 }, { stock: 2 }] })), true);
  assert.equal(isFinderPurchasable(bag('1001', { purchasable: false })), false);
});
