import { reviewGroupKey } from '../../assets/review-groups.js';

// Input is captured from the public review UI, never generated from product copy.
export function normalizeCoupangReviews(records, products) {
  if (!Array.isArray(records) || !records.length) throw new Error('쿠팡 리뷰 원본이 비어 있습니다.');
  const seen = new Set();
  return records.map((record) => {
    const sourceReviewId = String(record.sourceReviewId || '').trim();
    if (!/^\d+$/.test(sourceReviewId) || seen.has(sourceReviewId)) throw new Error('쿠팡 리뷰 번호가 없거나 중복되었습니다.');
    seen.add(sourceReviewId);
    const source = new URL(record.sourceUrl);
    if (source.protocol !== 'https:' || source.hostname !== 'www.coupang.com' || !/^\/vp\/products\/\d+$/.test(source.pathname) || source.username || source.password) throw new Error('쿠팡 원본 상품 주소를 확인해 주세요.');
    const sourceProductName = String(record.sourceProductName || '').trim();
    const product = products.find((p) => p.id === record.productId);
    const groupKey = reviewGroupKey(sourceProductName) || String(record.groupKey || '');
    if (!product || !groupKey || reviewGroupKey(product.name, product.model) !== groupKey || !sourceProductName) throw new Error('리뷰와 상품 모델이 일치하지 않습니다.');
    if (!products.some((p) => p.url === source.origin + source.pathname && reviewGroupKey(p.name, p.model) === groupKey)) throw new Error('카탈로그에서 확인되지 않은 쿠팡 상품입니다.');
    const rating = Number(record.rating);
    const content = String(record.content || '').trim();
    const title = String(record.title || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || content.length > 20000 || title.length > 500) throw new Error('리뷰 평점이나 본문을 확인해 주세요.');
    const date = String(record.createdAt || '');
    if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !/(Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date) > Date.now()) throw new Error('원본 작성일과 시간대를 확인해 주세요.');
    const reviewer = String(record.reviewerName || '').trim();
    const mediaUrls = [...new Set(record.mediaUrls || [])];
    if (mediaUrls.length > 20 || mediaUrls.some((value) => { try { const u = new URL(value); return u.protocol !== 'https:' || !u.hostname.endsWith('.coupangcdn.com') || !/\/PRODUCTREVIEW\//i.test(u.pathname); } catch { return true; } })) throw new Error('쿠팡 리뷰 첨부 주소를 확인해 주세요.');
    return { sourceReviewId, productId: product.id, groupKey, sourceProductName, rating, content,
      title: title || (content ? '쿠팡 사용 후기' : '별점 리뷰'),
      reviewerName: !reviewer ? '비공개 작성자' : reviewer.includes('*') ? reviewer.slice(0, 40) : `${[...reviewer].slice(0, 1).join('')}****`,
      sourceSeller: String(record.sourceSeller || '').trim().slice(0, 120),
      mediaUrls, createdAt: new Date(date).toISOString(),
      sourceUrl: `${source.origin}${source.pathname}#sdpReview`,
      status: record.status === 'rejected' ? 'rejected' : 'published',
    };
  });
}
