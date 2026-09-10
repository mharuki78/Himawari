import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCoupangReviews } from '../api/_lib/coupang-reviews.js';
import { reviewGroupKey } from '../assets/review-groups.js';

const url = 'https://www.coupang.com/vp/products/8653683089';
const products = [{ id: 'store-123', name: 'No.1027 민트' }, { id: 'coupang-123', name: 'No.1027 블랙', url }, { id: 'coupang-124', name: 'No.124S 블랙', url: 'https://www.coupang.com/vp/products/8645627102' }];
const sample = { sourceReviewId: '123', productId: 'store-123', sourceUrl: url, sourceProductName: '히마와리 No.1027 블랙', reviewerName: '테스트작성자', rating: 2, title: '원본 제목', content: '쿠팡체험단 이벤트로 상품을 무료 제공받아 작성한 리뷰입니다.\n원본 본문', createdAt: '2026-01-02T00:00:00+09:00', sourceSeller: '원본 판매자', mediaUrls: ['https://thumbnail.coupangcdn.com/thumbnails/local/320/image2/PRODUCTREVIEW/202601/2/photo.jpg'] };
const normalize = (overrides = {}) => normalizeCoupangReviews([{ ...sample, ...overrides }], products)[0];

test('Coupang import preserves low rating, text, disclosure, date, media and seller', () => {
  const r = normalize();
  for (const key of ['rating', 'title', 'content', 'mediaUrls', 'sourceSeller']) assert.deepEqual(r[key], sample[key]);
  assert.equal(r.createdAt, '2026-01-01T15:00:00.000Z');
  assert.equal(r.reviewerName, '테****');
  assert.equal(r.sourceUrl, url + '#sdpReview');
  assert.equal(r.groupKey, '1027');
});
test('Coupang rating-only records remain empty and hidden records stay hidden', () => {
  const r = normalize({ content: '', title: '', reviewerName: '', status: 'rejected' });
  assert.equal(r.content, '');
  assert.equal(r.title, '별점 리뷰');
  assert.equal(r.reviewerName, '비공개 작성자');
  assert.equal(r.status, 'rejected');
});
test('Coupang import rejects duplicate IDs, wrong products, unsafe URLs and invalid data', () => {
  assert.throws(() => normalizeCoupangReviews([sample, sample], products));
  for (const patch of [{ sourceReviewId: '' }, { productId: 'missing' }, { productId: 'coupang-124' }, { sourceUrl: 'https://www.coupang.com.evil.test/vp/products/1' }, { sourceUrl: 'https://www.coupang.com/vp/products/99' }, { rating: 0 }, { rating: 6 }, { createdAt: '2026-01-02' }, { createdAt: '2099-01-02T00:00:00Z' }, { mediaUrls: ['https://example.com/photo.jpg'] }]) assert.throws(() => normalize(patch));
});
test('Coupang model spelling retains sizes and aliases', () => {
  assert.equal(reviewGroupKey('히마와리 No 124s 블랙'), '124S');
  assert.equal(reviewGroupKey('히마와리 No 124 블랙'), '124');
  assert.equal(reviewGroupKey('히마와리 No.H1084 블랙'), '1084H');
  assert.equal(reviewGroupKey('히마와리 No.1084H 블랙'), '1084H');
  assert.equal(reviewGroupKey('히마와리 NO.188L'), '188L');
});
