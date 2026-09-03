import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  allowedAdminTransitions,
  calculateOrderTotals,
  customerOrderAction,
  validateOrderFields,
  validateOrderItems,
} from '../api/_lib/orders.js';
import { fetch as adminOrdersHandler } from '../api/admin/orders.js';
import { fetch as ordersHandler } from '../api/orders.js';

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  MEMBER_SESSION_SECRET: process.env.MEMBER_SESSION_SECRET,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
};

test.after(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function request(url, method = 'GET', body, headers = {}) {
  return new Request(url, {
    method,
    headers: {
      Origin: new URL(url).origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('주문 배송비는 10만원 미만 3,500원, 이상 무료로 서버 계산한다', () => {
  assert.equal(SHIPPING_FEE, 3_500);
  assert.equal(FREE_SHIPPING_THRESHOLD, 100_000);
  assert.deepEqual(calculateOrderTotals([{ unitPrice: 48_000, quantity: 2 }]), { subtotal: 96_000, shippingFee: 3_500, total: 99_500 });
  assert.deepEqual(calculateOrderTotals([{ unitPrice: 50_000, quantity: 2 }]), { subtotal: 100_000, shippingFee: 0, total: 100_000 });
});

test('주문서 필수 배송정보와 약관 동의를 검증한다', () => {
  const valid = validateOrderFields({
    requestId: '9b3571c6-66cb-4f30-85a7-79ca7486054e',
    recipientName: '남 영선',
    email: 'ORDER@example.com',
    phone: '010-5337-3981',
    postalCode: '15000',
    addressLine1: '경기도 시흥시 배곧4로 32-29',
    addressLine2: '파크뷰 206호',
    deliveryNote: '문 앞에 놓아 주세요.',
    termsConsent: true,
    privacyConsent: true,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.value.email, 'order@example.com');

  const invalid = validateOrderFields({ requestId: 'wrong', termsConsent: false, privacyConsent: false });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.fieldErrors).sort(), ['addressLine1', 'email', 'form', 'phone', 'postalCode', 'privacyConsent', 'recipientName', 'termsConsent']);
});

test('주문 상품은 중복 ID와 잘못된 수량을 거부한다', () => {
  assert.equal(validateOrderItems([{ productId: 'bag-1', quantity: 2 }]).valid, true);
  assert.equal(validateOrderItems([{ productId: 'bag-1', quantity: 1 }, { productId: 'bag-1', quantity: 2 }]).valid, false);
  assert.equal(validateOrderItems([{ productId: 'bag-1', quantity: 0 }]).valid, false);
});

test('고객 요청과 관리자 상태 전이를 단계별로 제한한다', () => {
  assert.equal(customerOrderAction('payment_pending'), 'request_cancel');
  assert.equal(customerOrderAction('shipped'), 'request_refund');
  assert.equal(customerOrderAction('cancelled'), '');
  assert.deepEqual(allowedAdminTransitions('payment_pending'), ['confirmed', 'cancelled']);
  assert.deepEqual(allowedAdminTransitions('cancel_requested', 'payment_pending'), ['payment_pending', 'cancelled']);
  assert.deepEqual(allowedAdminTransitions('cancel_requested', 'preparing'), ['preparing', 'cancelled']);
  assert.deepEqual(allowedAdminTransitions('refund_requested', 'shipped'), ['shipped', 'refunded']);
  assert.deepEqual(allowedAdminTransitions('refunded'), []);
});

test('회원 주문 API는 로그인 없는 요청을 거부한다', async () => {
  delete process.env.DATABASE_URL;
  process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const response = await ordersHandler(request('https://allaboutbag.com/api/orders'));
  assert.equal(response.status, 401);
});

test('관리자 주문 API는 DB나 관리자 인증이 없으면 데이터를 노출하지 않는다', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_SESSION_SECRET;
  const response = await adminOrdersHandler(request('https://allaboutbag.com/api/admin/orders'));
  assert.equal(response.status, 503);
});
