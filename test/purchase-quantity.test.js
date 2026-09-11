import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseQuantity } from '../assets/purchase-quantity.js';

test('구매 경로의 수량은 입력값과 재고에 따라 동일하게 제한한다', () => {
  assert.equal(purchaseQuantity('3', null), 3);
  assert.equal(purchaseQuantity('3', 2), 2);
  assert.equal(purchaseQuantity('999', null), 99);
  for (const input of ['', null, '-7', 'NaN', 'Infinity', 'not-a-number']) {
    assert.equal(purchaseQuantity(input, 10), 1);
  }
  assert.equal(purchaseQuantity('2.5', 10), 2);
});

test('선택한 옵션의 재고가 줄어들면 전달 수량도 내려간다', () => {
  const previousQuantity = purchaseQuantity(5, 8);
  assert.equal(purchaseQuantity(previousQuantity, 2), 2);
  assert.equal(purchaseQuantity(previousQuantity, 1000), 5);
});
