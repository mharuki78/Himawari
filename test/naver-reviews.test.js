import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNaverReviews, reviewGroupKey } from '../api/_lib/naver-reviews.js';

const sample = { sourceReviewId: '123', productId: 'store-13326224850', reviewerName: 'buyerid', rating: 4, content: '테스트용 원본 내용', createdAt: '2026-01-03T10:00:00+09:00' };
const normalize = (records) => normalizeNaverReviews(records, [sample.productId]);
test('Naver import preserves source rating/text/date and masks author', () => {
  const [review] = normalize([sample]);
  assert.equal(review.content, sample.content);
  assert.equal(review.rating, 4);
  assert.equal(review.createdAt, '2026-01-03T01:00:00.000Z');
  assert.equal(review.reviewerName, 'bu****');
  assert.equal(review.sourceUrl, 'https://smartstore.naver.com/baegot/products/13326224850#REVIEW');
  assert.equal(review.verified, undefined);
});
test('Naver import refuses missing provenance, mismapped products, invalid ratings and ambiguous dates', () => {
  for (const override of [{ sourceReviewId: '' }, { productId: 'store-9' }, { rating: 0 }, { rating: 6 }, { content: '' }, { createdAt: '2026-01-03' }]) {
    assert.throws(() => normalize([{ ...sample, ...override }]));
  }
  assert.throws(() => normalize([sample, sample]));
  assert.throws(() => normalize([]));
});
test('Review groups preserve model, size and bundle distinctions', () => {
  assert.equal(reviewGroupKey('히마와리 네모백 1884'), '1884');
  assert.equal(reviewGroupKey('No.1884 블랙'), '1884');
  assert.equal(reviewGroupKey('No.1884 블랙M'), '1884M');
  assert.equal(reviewGroupKey('No.0514/0514Mini 실버미니'), '0514MINI');
  assert.equal(reviewGroupKey('No.0514 0514Mini 실버'), '0514');
  assert.equal(reviewGroupKey('No.124S 그레이'), '124S');
  assert.equal(reviewGroupKey('No.1027+체스트벨트 SET'), '1027-SET');
  assert.equal(reviewGroupKey('히마와리 가방 체스트벨트'), 'CHEST-BELT');
});
test('Imported hidden reviews remain hidden and only Naver media is admitted', () => {
  const [review] = normalize([{...sample, status: 'rejected', mediaUrls: ['https://phinf.pstatic.net/review.jpg', 'javascript:alert(1)', 'https://example.com/tracker.jpg'], reviewType:'한달사용'}]);
  assert.equal(review.status, 'rejected');
  assert.deepEqual(review.mediaUrls, ['https://phinf.pstatic.net/review.jpg']);
  assert.equal(review.title, '한 달 사용 리뷰');
});
