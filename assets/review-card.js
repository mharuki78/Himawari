export function createReviewCard(review) {
  const article = document.createElement('article');
  article.className = 'review-card';
  const head = document.createElement('div');
  const stars = document.createElement('span');
  const rating = Math.max(1, Math.min(5, Number(review.rating) || 1));
  stars.textContent = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  stars.setAttribute('aria-label', `5점 중 ${rating}점`);
  const badge = document.createElement('strong');
  badge.textContent = review.source === 'naver' ? '네이버 스마트스토어' : review.verified ? '구매 확인' : '';
  head.append(stars, badge);
  const title = document.createElement('h3');
  title.textContent = review.title || '사용 후기';
  const content = document.createElement('p');
  content.textContent = review.content;
  const byline = document.createElement('small');
  byline.textContent = `${review.reviewerName} · ${new Date(review.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  article.append(head, title, content, byline);
  if (review.sourceProductName) {
    const product = document.createElement('small');
    product.textContent = `구매 상품 · ${review.sourceProductName}`;
    article.append(product);
  }
  const gallery = document.createElement('div');
  gallery.className = 'review-media';
  const urls = [...new Set([review.mediaUrl, ...(review.mediaUrls || [])].filter(Boolean))];
  urls.forEach((value) => {
    let url;
    try { url = new URL(value); } catch { return; }
    if (url.protocol !== 'https:') return;
    // Exported Naver attachments may be videos: retain a link instead of a broken image.
    const link = document.createElement('a');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (/\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(url.href)) {
      const img = document.createElement('img');
      img.src = url.href;
      img.alt = `${review.reviewerName}님의 리뷰 사진 크게 보기`;
      img.loading = 'lazy';
      link.append(img);
    } else link.textContent = '첨부 영상·사진 보기 ↗';
    gallery.append(link);
  });
  if (gallery.childElementCount) article.append(gallery);
  try {
    const url = new URL(review.sourceUrl);
    if (review.source === 'naver' && url.protocol === 'https:' && url.hostname === 'smartstore.naver.com') {
      const link = document.createElement('a');
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '네이버에서 리뷰 보기 ↗';
      article.append(link);
    }
  } catch {}
  return article;
}
