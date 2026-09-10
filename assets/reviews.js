import { createReviewCard } from './review-card.js';

const list = document.querySelector('[data-all-reviews]');
const status = document.querySelector('[data-reviews-status]');
const more = document.querySelector('[data-reviews-more]');
let offset = 0;
async function load() {
  more.disabled = true;
  try {
    const response = await fetch(`/api/reviews?offset=${offset}`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    payload.reviews.forEach((review) => list.append(createReviewCard(review)));
    status.textContent = payload.aggregate.count ? `전체 ${payload.aggregate.count}개의 사용 기록 · 평균 ${payload.aggregate.ratingValue}점` : '아직 공개된 리뷰가 없습니다.';
    more.hidden = payload.nextOffset == null;
    offset = payload.nextOffset ?? offset;
    more.textContent = '리뷰 더 보기';
  } catch {
    status.textContent = '리뷰를 불러오지 못했습니다. 다시 시도해 주세요.';
    more.textContent = '다시 불러오기';
  } finally { more.disabled = false; }
}
more.addEventListener('click', load);
load();
