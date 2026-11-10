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

const journey = { intent: 'personal', use: 'commute', size: 'any', budget: 'any', priority: 'weight', color: 'any' };
const ids = result => result.items.map(item => item.product.id);

test('the redesigned finder honors each inclusive lower and exclusive upper budget boundary', () => {
  const prices = [29999, 30000, 49999, 50000, 79999, 80000, 99999, 100000];
  const products = prices.map(price => bag(String(price), { price }));
  const expected = {
    'under-30000': ['29999'], '30000-50000': ['30000', '49999'], '50000-80000': ['50000', '79999'],
    '80000-100000': ['80000', '99999'], '100000-plus': ['100000'],
  };
  for (const [budget, matches] of Object.entries(expected)) {
    assert.deepEqual(ids(findMatchingProducts(products, { ...journey, budget })), matches);
  }
});

test('size follows the longest measured exterior side, with unknown measurements allowed only for any size', () => {
  const dimensions = ['35.9 × 22 × 10 cm', '22 × 36 × 10 cm', '20 × 10 × 42.9 cm', '20 × 43 × 15 cm', '추정 22 × 36 × 10 cm'];
  const products = dimensions.map((value, i) => bag(String(2001 + i), { specs: { dimensions: value } }));
  for (const [size, matches] of Object.entries({ small: ['2001'], medium: ['2002', '2003'], large: ['2004'] })) {
    assert.deepEqual(ids(findMatchingProducts(products, { ...journey, size })), matches);
  }
  assert.equal(findMatchingProducts(products, journey).total, 5);
});

test('the selected use needs affirmative catalog support and laptops require actual internal dimensions', () => {
  const products = [
    bag('3001', { name: '출근 노트북백팩 No.3001', specs: { dimensions: '30 × 43 × 15 cm' } }),
    bag('3002', { name: '여행 데일리 백팩 No.3002', specs: { laptopCompartment: '28 × 37 × 2 cm', weight: '800 g' } }),
    bag('3003', { name: '클래식 백팩 No.3003', highlights: ['여행에 좋았어요'] }),
  ];
  for (const [use, matches] of Object.entries({ daily: ['3002'], travel: ['3002'], commute: ['3001'], laptop: ['3002', '3003'] })) {
    assert.deepEqual(ids(findMatchingProducts(products, { ...journey, use })), matches);
  }
  assert.match(findMatchingProducts(products, { ...journey, use: 'laptop' }).items[0].check, /수납칸 두께 2 cm/);
});

test('color filters exact available variants before choosing one representative per model', () => {
  const products = [
    bag('4001-red', { model: 'No.4001', name: '출근 백팩 No.4001 레드', featured: true }),
    bag('4001-blue', { model: 'No.4001', name: '출근 백팩 No.4001 네이비' }),
    bag('4001-sky', { model: 'No.4001', name: '출근 백팩 No.4001 스카이' }),
    bag('4002', { options: [{ label: '블루', stock: 0 }, { label: '블랙', stock: 2 }] }),
    bag('4003', { name: '출근 백팩 No.4003 실버', options: [{ label: '기본 구성', stock: 2 }] }),
  ];
  const blue = findMatchingProducts(products, { ...journey, intent: 'gift', color: 'blue' });
  assert.deepEqual(ids(blue), ['4001-blue']);
  assert.equal(blue.items[0].variantCount, 2);
  assert.deepEqual(ids(findMatchingProducts(products, { ...journey, color: 'silver' })), ['4003']);
});

test('verified priorities outrank gaps, and missing durability and capacity are explained', () => {
  const products = [
    bag('5001', { price: 40000, featured: true, specs: { weight: '1200 g' } }),
    bag('5002', { price: 70000, specs: { weight: '0.6 kg', capacity: '20 L' } }),
    bag('5003', { price: 20000, specs: {} }),
  ];
  const gift = { ...journey, intent: 'gift' };
  assert.deepEqual(ids(findMatchingProducts(products, gift)), ['5002', '5001', '5003']);
  const capacity = findMatchingProducts(products, { ...gift, priority: 'capacity' });
  assert.deepEqual(ids(capacity), ['5002', '5001', '5003']);
  assert.ok(capacity.items[0].reasons.includes('등록 용량 20 L'));
  assert.match(capacity.items[1].check, /등록된 용량\(L\)이 없어/);
  const durability = findMatchingProducts(products, { ...gift, priority: 'durability' });
  assert.deepEqual(ids(durability), ['5001', '5003', '5002']);
  assert.match(durability.items[0].check, /내구성 시험 자료/);
});
