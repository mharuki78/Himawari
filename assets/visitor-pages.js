export const VISITOR_PAGES = {
  '/': '홈',
  '/products.html': '가방 목록',
  '/product.html': '상품 상세',
  '/collections/school': '학생·책가방',
  '/collections/business': '출근·노트북',
  '/collections/travel': '여행·육아',
  '/collections/daily': '데일리·미니',
  '/black-friday/': '블랙프라이데이',
  '/black-friday/item/': '블랙프라이데이 상품 상세',
  '/finder.html': '가방 찾기',
  '/guidebook.html': '가이드북',
  '/compare.html': '상품 비교',
  '/story/': '이야기 목록',
  '/lookbook/': '룩북',
  '/about.html': '브랜드',
  '/care.html': '가방 관리',
  '/game.html': '게임',
  '/rhythm.html': '리듬 게임',
  '/contact.html': '연락하기',
};

export const VISITOR_PRODUCT_PAGES = new Set(['/product.html', '/black-friday/item/']);
export const STORY_PATH = /^\/story\/[a-z0-9-]{1,120}\.html$/;

export function visitorPage(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/story/admin.html') return null;
  if (/^\/black-friday\/item\/[a-z0-9-]+$/i.test(path)) return '/black-friday/item/';
  if (['/story', '/lookbook', '/black-friday'].includes(path)) return `${path}/`;
  if (path === '/index.html') return '/';
  if (path === '/story/index.html') return '/story/';
  if (path === '/lookbook/index.html') return '/lookbook/';
  return Object.hasOwn(VISITOR_PAGES, path) || STORY_PATH.test(path) ? path : null;
}

export function visitorDay(time = Date.now()) {
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
