import assert from 'node:assert/strict';
import test from 'node:test';

import { activeCoupons, defaultPromotions, normalizePromotions, publicPromotions, validatePromotionsInput } from '../api/_lib/promotions.js';
import { fetch as promotionsHandler } from '../api/products.js';

test('초기 프로모션은 안내 팝업을 제공하고 네 종류 쿠폰을 안전하게 비활성화한다', () => {
  const config = defaultPromotions();
  assert.equal(config.popup.enabled, true);
  assert.deepEqual(config.coupons.map((coupon) => coupon.id), ['shipping-free', 'discount-10', 'discount-15', 'discount-20']);
  assert.equal(activeCoupons(config).length, 0);
});

test('종료된 쿠폰은 공개하지 않고 고정 쿠폰의 할인율은 관리자 입력으로 바뀌지 않는다', () => {
  const config = normalizePromotions({ coupons: [
    { id: 'discount-10', active: true, rate: 99, expiresAt: '2099-01-01T00:00:00.000Z' },
    { id: 'discount-20', active: true, expiresAt: '2020-01-01T00:00:00.000Z' },
  ] });
  const coupons = activeCoupons(config, new Date('2026-09-06T00:00:00.000Z'));
  assert.equal(coupons.length, 1);
  assert.equal(coupons[0].rate, 10);
});

test('팝업 링크는 자사몰 내부 경로만 허용한다', () => {
  const invalid = validatePromotionsInput({
    popup: { enabled: true, title: '쿠폰 안내', message: '혜택을 확인해 주세요.', linkLabel: '보기', linkUrl: 'https://evil.example/' },
    coupons: [],
  });
  assert.equal(invalid.valid, false);
  assert.equal(typeof invalid.fieldErrors.popupLinkUrl, 'string');
});

test('저장소가 없으면 공개 API는 비활성 기본값을 제공한다', async () => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const response = await promotionsHandler(new Request('https://allaboutbag.com/api/products?route=promotions'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.popup.enabled, true);
    assert.deepEqual(payload.coupons, []);
    assert.deepEqual(publicPromotions(defaultPromotions()).coupons, []);
  } finally {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
  }
});
