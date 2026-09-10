// Only normalized seller-export records belong here. Never synthesize review content.
import { reviewGroupKey } from '../../assets/review-groups.js';
export { reviewGroupKey };

export function normalizeNaverReviews(records, productIds) {
  if (!Array.isArray(records) || !records.length) throw new Error('리뷰 원본이 비어 있습니다.');
  const allowed = new Set(productIds);
  const seen = new Set();
  return records.map((record) => {
    const sourceReviewId = String(record.sourceReviewId || '').trim();
    const productId = String(record.productId || '').trim();
    const rating = Number(record.rating);
    const content = String(record.content || '').trim();
    const date = String(record.createdAt || '');
    const reviewer = String(record.reviewerName || '').trim();
    if (!/^\d+$/.test(sourceReviewId) || seen.has(sourceReviewId)) throw new Error('리뷰 번호가 없거나 중복되었습니다.');
    if (!allowed.has(productId) || !/^store-\d+$/.test(productId)) throw new Error('확인된 원본에 없는 상품의 리뷰입니다.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !content || content.length > 20000) throw new Error('리뷰 내용 또는 평점을 확인해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !/(Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date) > Date.now()) throw new Error('원본 작성일과 시간대를 확인해 주세요.');
    if (!reviewer) throw new Error('리뷰 작성자 표시가 없습니다.');
    seen.add(sourceReviewId);
    return {
      sourceReviewId, productId, rating, content,
      sourceProductName: String(record.sourceProductName || '').trim().slice(0, 300),
      groupKey: reviewGroupKey(record.sourceProductName),
      status: record.status === 'rejected' ? 'rejected' : 'published',
      title: record.reviewType === '한달사용' ? '한 달 사용 리뷰' : '구매 리뷰',
      mediaUrls: (record.mediaUrls || []).filter((url) => { try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname === 'pstatic.net' || u.hostname.endsWith('.pstatic.net')); } catch { return false; } }).slice(0, 20),
      reviewerName: reviewer.includes('*') ? reviewer.slice(0, 40) : `${[...reviewer].slice(0, 2).join('')}****`,
      createdAt: new Date(date).toISOString(),
      sourceUrl: `https://smartstore.naver.com/baegot/products/${productId.slice(6)}#REVIEW`,
    };
  });
}
