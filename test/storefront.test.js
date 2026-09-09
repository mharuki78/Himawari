import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { fetch as productsHandler } from '../api/products.js';
import { fetch as storefrontHandler } from '../api/storefront.js';
import { publicProduct, seedCatalog } from '../api/_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from '../api/_lib/storefront.js';
import { groupProductFamilies } from '../assets/catalog-tools.js';

const products = seedCatalog().products.map(publicProduct);

test('모든 HTML 페이지와 상품 템플릿이 공통 파비콘을 선언한다', async () => {
  const rootFiles = ['404.html', 'about.html', 'account.html', 'checkout.html', 'contact.html', 'finder.html', 'game.html', 'guest-order.html', 'index.html', 'privacy.html', 'terms.html'];
  const nestedFiles = await Promise.all(['admin', 'story', 'templates'].map(async (directory) => {
    const files = await readdir(new URL(`../${directory}/`, import.meta.url));
    return files.filter((file) => file.endsWith('.html')).map((file) => `${directory}/${file}`);
  }));
  const htmlFiles = rootFiles.concat(...nestedFiles);

  for (const file of htmlFiles) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/, `${file}: favicon.ico`);
    assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/assets\/favicon-32\.png">/, `${file}: 32px favicon`);
    assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/assets\/apple-touch-icon\.png">/, `${file}: Apple touch icon`);
  }
});

test('모든 공개 페이지가 동일한 6개 주요 메뉴를 제공한다', async () => {
  const rootFiles = ['404.html', 'about.html', 'account.html', 'checkout.html', 'contact.html', 'finder.html', 'game.html', 'guest-order.html', 'index.html', 'privacy.html', 'terms.html'];
  const storyFiles = (await readdir(new URL('../story/', import.meta.url)))
    .filter((file) => file.endsWith('.html') && file !== 'admin.html')
    .map((file) => `story/${file}`);
  const templateFiles = ['templates/product.html', 'templates/products.html'];
  const htmlFiles = [...rootFiles, ...storyFiles, ...templateFiles];
  const expectedLabels = ['제품', '가방 찾기', '브랜드', '이야기', '게임', '연락하기'];
  const expectedHrefs = ['/products.html', '/finder.html', '/about.html', '/story/', '/game.html', '/contact.html'];

  for (const file of htmlFiles) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const navigation = html.match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
    const links = [...navigation.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];

    assert.deepEqual(links.map((link) => link[3]), expectedLabels, `${file}: 메뉴 이름과 순서`);
    assert.deepEqual(links.map((link) => link[1]), expectedHrefs, `${file}: 메뉴 링크`);
  }
});

test('홈 첫 화면은 No.1884 도시형 히어로 영상과 릴스 8개를 제공한다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const gearCss = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');

  assert.match(html, /class="home-film-hero__video"[^>]+poster="assets\/hero-products-motion-poster\.png"/);
  assert.match(html, /<source src="assets\/hero-products-motion\.mp4" type="video\/mp4">/);
  assert.match(html, /No\.1884 백팩을 착용한 직장인이 도심을 걷는 모습/);
  assert.match(html, /class="home-film-hero__toggle"[^>]+data-ambient-toggle/);
  assert.doesNotMatch(html, /class="home-film-hero__image"/);
  assert.equal((html.match(/data-reel-card/g) || []).length, 8);
  assert.equal((html.match(/data-reel-src=/g) || []).length, 8);
  assert.equal((html.match(/preload="none"/g) || []).length, 8);
  assert.doesNotMatch(html, /onclick=/);
  assert.match(html, /assets\/reel-0514-260527\.mp4/);
  assert.match(html, /assets\/reel-0514-260604\.mp4/);
  assert.match(html, /assets\/reel-0424-260528\.mp4/);
  assert.match(html, /3 \/ 8 · No\.1884 영상/);
  assert.match(gearCss, /url\("himawari-logo-hq\.png"\)/);
  assert.doesNotMatch(gearCss, /url\("himawari-logo\.png"\)/);

  for (const asset of [
    'assets/himawari-logo-hq.png',
    'assets/hero-products-motion.mp4',
    'assets/hero-products-motion-poster.png',
    'assets/reel-0514-260527.mp4',
    'assets/reel-0514-260527-poster.jpg',
    'assets/reel-0514-260604.mp4',
    'assets/reel-0514-260604-poster.jpg',
    'assets/reel-0424-260528.mp4',
    'assets/reel-0424-260528-poster.jpg',
  ]) {
    await access(new URL(`../${asset}`, import.meta.url));
  }
});

test('최신 이야기 3편은 독립 페이지·대표 이미지·검색 메타데이터를 갖춘다', async () => {
  const posts = JSON.parse(await readFile(new URL('../story/posts.json', import.meta.url), 'utf8'));
  const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const feed = await readFile(new URL('../feed.xml', import.meta.url), 'utf8');
  const slugs = [
    'small-frame-backpack-fit-guide',
    'autumn-commute-backpack-packing',
    'backpack-odor-airing-guide',
  ];

  assert.deepEqual(posts.slice(0, 3).map((post) => post.id), slugs);

  for (const slug of slugs) {
    const post = posts.find((entry) => entry.id === slug);
    const html = await readFile(new URL(`../story/${slug}.html`, import.meta.url), 'utf8');
    const imagePath = post.image.replace('../', '');

    assert.equal(post.date, '2026-09-09');
    await access(new URL(`../${imagePath}`, import.meta.url));
    assert.match(html, new RegExp(`<link rel="canonical" href="https://himawari\\.co\\.kr/story/${slug}\\.html">`));
    assert.match(html, new RegExp(`<meta property="og:image" content="https://himawari\\.co\\.kr/assets/story/${slug}\\.webp">`));
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /class="story-related"/);
    assert.match(html, /class="story-faq"/);
    assert.equal(sitemap.includes(`https://himawari.co.kr/story/${slug}.html`), true);
    assert.equal(feed.includes(`https://himawari.co.kr/story/${slug}.html`), true);
  }
});

test('상품 목록 원본 HTML에 전체 카탈로그를 제품군으로 묶고 구조화 데이터를 렌더링한다', async () => {
  const template = await readFile(new URL('../templates/products.html', import.meta.url), 'utf8');
  const html = renderCatalogPage(template, products);

  assert.equal((html.match(/data-server-rendered-product/g) || []).length, groupProductFamilies(products).length);
  assert.match(html, /히마와리 학생가방 책가방 데일리 백팩 No\.1027/);
  assert.match(html, /"numberOfItems":34/);
  assert.doesNotMatch(html, /SERVER_CATALOG_SCHEMA|SERVER_FEATURED_PRODUCT|SERVER_PRODUCT_GRID/);
  assert.doesNotMatch(html, /제품을 불러오는 중입니다/);
  assert.match(html, /<strong data-product-count>34<\/strong>/);
  assert.match(html, /href="checkout\.html\?product=[^"]+"[^>]*>바로 구매하기/);
});

test('사이트맵은 모든 공개 제품 상세페이지를 포함한다', async () => {
  const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');

  for (const product of products) {
    assert.equal(
      sitemap.includes(`https://himawari.co.kr/product.html?id=${encodeURIComponent(product.id)}`),
      true,
      `${product.id}: sitemap product URL`,
    );
  }
});

test('운영 사이트맵은 현재 제품과 이야기 목록을 XML로 동적 제공한다', async () => {
  const response = await productsHandler(new Request('https://himawari.co.kr/api/products?route=sitemap'));
  const sitemap = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/xml/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 78);
  for (const product of products) {
    assert.equal(sitemap.includes(`https://himawari.co.kr/product.html?id=${encodeURIComponent(product.id)}`), true);
  }
  assert.equal(sitemap.includes('https://himawari.co.kr/story/small-frame-backpack-fit-guide.html'), true);
});

test('개별 제품 원본 HTML에 이름·가격·이미지·구매정보를 렌더링한다', async () => {
  const template = await readFile(new URL('../templates/product.html', import.meta.url), 'utf8');
  const product = products[0];
  const html = renderProductPage(template, product);

  assert.match(html, new RegExp(`<article data-product-content>`));
  assert.equal(html.includes(product.name), true);
  assert.match(html, /76,800/);
  assert.doesNotMatch(html, /네이버 할인가와 동일/);
  assert.match(html, /data-loading-state role="status" hidden/);
  assert.match(html, /주문 전<br>꼭 확인해 주세요/);
  assert.match(html, /이용약관 전체 보기/);
  assert.equal(html.includes('로젠택배'), true);
  assert.equal(html.includes('기본 배송비는 3,500원'), true);
  assert.equal(html.includes('100,000원 이상은 무료배송'), true);
  assert.equal(html.includes('편도·왕복 반품비는 8,000원'), true);
  assert.equal(html.includes('golf4484@naver.com'), true);
  assert.match(html, new RegExp(`data-direct-buy href="checkout\\.html\\?product=${product.id}"`));
  assert.match(html, new RegExp(`data-closing-buy href="checkout\\.html\\?product=${product.id}"`));
  assert.match(html, new RegExp(`data-npay-product data-product-id="${product.id}"`));
  assert.match(html, /Npay로 구매/);
});

test('홈 제품 목록에는 Npay 버튼을 요청하지 않는다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /data-npay-cards|data-npay-card/);
});

test('공통 푸터는 인스타그램과 유튜브 채널을 아이콘과 함께 제공한다', async () => {
  const memberJs = await readFile(new URL('../assets/member.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(memberJs, /function buildFooterSocialLinks\(\)/);
  assert.match(memberJs, /https:\/\/www\.youtube\.com\/@himawarikorea/);
  assert.match(memberJs, /footer-social-link--' \+ network/);
  assert.match(css, /\.footer-social-link--instagram:hover/);
  assert.match(css, /\.footer-social-link--youtube \.footer-social-icon/);
  assert.match(home, /"https:\/\/www\.youtube\.com\/@himawarikorea"/);
});

test('전체 제품 페이지는 Npay 버튼 없이 대표 상품과 묶인 제품군 카드를 제공한다', async () => {
  const template = await readFile(new URL('../templates/products.html', import.meta.url), 'utf8');
  const html = renderCatalogPage(template, products);

  assert.doesNotMatch(html, /data-npay-cards|data-npay-card/);
  assert.equal((html.match(/data-server-rendered-product/g) || []).length, groupProductFamilies(products).length);
});

test('네이버페이 검수는 비공개 세션에서 전체 상품 목록과 모든 상세페이지를 제공한다', async () => {
  const previous = process.env.NPAY_REVIEW_TOKEN;
  process.env.NPAY_REVIEW_TOKEN = 'review-token-example';
  try {
    const entry = await storefrontHandler(new Request('https://himawari.co.kr/api/storefront?page=npay-review&token=review-token-example'));
    const cookie = entry.headers.get('set-cookie') || '';
    assert.equal(entry.status, 302);
    assert.equal(entry.headers.get('location'), 'https://himawari.co.kr/npay-review-products.html');
    assert.match(cookie, /__Host-himawari_npay_review=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

    for (const page of ['npay-review-catalog', 'npay-review-product']) {
      const denied = await storefrontHandler(new Request(`https://himawari.co.kr/api/storefront?page=${page}&id=${products[0].id}`));
      assert.equal(denied.status, 404);
      assert.match(denied.headers.get('cache-control'), /no-store/);
    }
    const invalid = await storefrontHandler(new Request('https://himawari.co.kr/api/storefront?page=npay-review&token=wrong'));
    assert.equal(invalid.status, 404);
    const catalog = await storefrontHandler(new Request('https://himawari.co.kr/api/storefront?page=npay-review-catalog', { headers: { Cookie: cookie.split(';')[0] } }));
    assert.equal(catalog.status, 200);
    assert.match(catalog.headers.get('cache-control'), /no-store/);
    const catalogHtml = await catalog.text();
    assert.equal((catalogHtml.match(/data-review-product=/g) || []).length, products.length);
    for (const product of products) {
    assert.ok(catalogHtml.includes(`data-review-product="${product.id}"`));
    const detail = await storefrontHandler(new Request(`https://himawari.co.kr/api/storefront?page=npay-review-product&id=${encodeURIComponent(product.id)}`, {
      headers: { Cookie: cookie.split(';')[0] },
    }));
    const html = await detail.text();
    assert.equal(detail.status, 200);
    assert.equal(detail.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.equal(detail.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.match(html, /class="product-detail-page"/);
    assert.match(html, /data-npay-product data-product-id=/);
    assert.match(html, /npay-review-products\.html/);
    }
  } finally {
    if (previous === undefined) delete process.env.NPAY_REVIEW_TOKEN;
    else process.env.NPAY_REVIEW_TOKEN = previous;
  }
});

test('제품 상세 구조화 데이터는 배송·반품·제품군 정보를 포함하고 모바일 빠른 구매를 제공한다', async () => {
  const template = await readFile(new URL('../templates/product.html', import.meta.url), 'utf8');
  const family = products.filter((product) => product.model === products[0].model);
  const html = renderProductPage(template, products[0], 'https://himawari.co.kr', null, family);
  assert.match(html, /OfferShippingDetails/);
  assert.match(html, /MerchantReturnPolicy/);
  assert.match(html, /ProductGroup/);
  assert.match(html, /hasVariant/);
  assert.match(html, /data-mobile-purchase/);
  assert.match(html, /data-review-form/);
});

test('공개 사이트는 분석·성능 측정, 브랜드 404와 기본 보안 헤더를 제공한다', async () => {
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const notFound = await readFile(new URL('../404.html', import.meta.url), 'utf8');
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const globalHeaders = vercel.headers.find((entry) => entry.source === '/(.*)')?.headers || [];

  assert.match(script, /\/_vercel\/insights\/script\.js/);
  assert.match(script, /\/_vercel\/speed-insights\/script\.js/);
  assert.match(script, /Add to cart/);
  assert.match(notFound, /404 · Wrong pocket/);
  assert.match(notFound, /나에게 맞는 가방 찾기/);
  assert.equal(globalHeaders.some((header) => header.key === 'Content-Security-Policy'), true);
  assert.equal(globalHeaders.some((header) => header.key === 'Permissions-Policy'), true);
  assert.equal(globalHeaders.some((header) => header.key === 'X-Frame-Options'), true);
});

test('내부 주문서는 PG 미연결 경계와 앱 소유 검증을 명확히 표시한다', async () => {
  const html = await readFile(new URL('../checkout.html', import.meta.url), 'utf8');

  assert.match(html, /data-checkout-form novalidate/);
  assert.match(html, /data-checkout-guest-note/);
  assert.match(html, /회원가입 없이 주문을 접수할 수 있습니다/);
  assert.doesNotMatch(html, /data-checkout-login/);
  assert.match(html, /결제 대기로 주문 접수/);
  assert.match(html, /PG 결제 연결 준비 중/);
  assert.doesNotMatch(html, /네이버페이 구매|카카오페이|결제 완료로 주문/);
});

test('No.0422 게임은 두 단계 진행과 활성 쿠폰 주문서 연결을 제공한다', async () => {
  const html = await readFile(new URL('../game.html', import.meta.url), 'utf8');
  const gameJs = await readFile(new URL('../assets/game.js', import.meta.url), 'utf8');
  const gameCss = (await Promise.all(['game.css', 'game-items.css'].map((file) => readFile(new URL('../assets/' + file, import.meta.url), 'utf8')))).join('\n');
  const checkoutJs = await readFile(new URL('../assets/checkout.js', import.meta.url), 'utf8');

  await access(new URL('../assets/game-pixel-school-world.png', import.meta.url));
  await access(new URL('../assets/game-pixel-player.png', import.meta.url));
  assert.match(html, /<title>HIMAWARI BAG QUEST — 0422 등굣길 어드벤처<\/title>/);
  assert.match(html, /등굣길 퀘스트 시작/);
  assert.match(html, /data-game-panel="catch"/);
  assert.match(html, /data-game-panel="pack"/);
  assert.match(html, /data-game-panel="result"/);
  assert.match(html, /assets\/game-pixel-school-world\.png/);
  assert.match(html, /assets\/game-pixel-player\.png/);
  assert.match(html, /data-game-move="up"/);
  assert.match(html, /data-game-jump/);
  assert.match(html, /data-game-fire/);
  assert.match(html, /점프로 위험물을 넘고, 새총으로 아령을 부수면/);
  assert.match(html, /data-game-lives/);
  assert.match(html, /data-player-shadow/);
  assert.match(html, /data-game-sound/);
  assert.match(html, /data-game-exit/);
  assert.match(html, /id="game-rules-title"/);
  assert.match(html, /35초 동안 모으기/);
  assert.match(html, /2,100점 20%/);
  assert.match(html, /product\.html\?id=store-13326274540/);
  assert.match(gameJs, /var REWARD_STORAGE_KEY = 'himawari-game-coupon-v1'/);
  assert.match(gameJs, /'shipping-free'/);
  assert.match(gameJs, /'discount-10'/);
  assert.match(gameJs, /'discount-15'/);
  assert.match(gameJs, /'discount-20'/);
  assert.match(gameJs, /event\.isComposing/);
  assert.match(gameJs, /function createFootstep/);
  assert.match(gameJs, /AudioContext/);
  assert.match(gameJs, /function playMusicStep/);
  assert.match(gameJs, /function setGameViewport/);
  assert.match(gameJs, /function animatePackedItem/);
  assert.match(gameJs, /function jumpPlayer/);
  assert.match(gameJs, /function fireSlingshot/);
  assert.match(gameJs, /object\.item\.id === 'weight'/);
  assert.match(gameJs, /key === 'f' \|\| key === 'j'/);
  assert.match(gameJs, /PACK_TRANSFER_MS/);
  assert.match(gameJs, /마지막 정리를 확인하고 있습니다/);
  assert.match(gameJs, /state\.phase === 'intro'/);
  assert.match(gameJs, /touchmove/);
  assert.doesNotMatch(gameJs, /sprite\.textContent\s*=\s*item\.code/);
  assert.match(gameJs, /--player-flip/);
  assert.match(gameCss, /\.pixel-player\.is-walking/);
  assert.match(gameCss, /\.adventure-stage\.is-moving \.player-shadow/);
  assert.match(gameCss, /body\.game-round-active \.game-console\[data-phase="catch"\]/);
  assert.match(gameCss, /body\.game-round-active \.game-console:not\(\[data-phase="intro"\]\)/);
  assert.match(gameCss, /height: 100dvh/);
  assert.match(gameCss, /\.pixel-player\.is-jumping/);
  assert.match(gameCss, /\.slingshot-shot/);
  assert.match(gameCss, /width: clamp\(3\.2rem, 17cqw, 5\.4rem\)/);
  assert.match(gameCss, /@keyframes pack-transfer-flight/);
  assert.match(gameCss, /\.packing-bag\.is-receiving/);
  assert.match(gameCss, /\.pack-transfer \{ display: none; \}/);
  assert.match(gameCss, /\.collectible\[data-kind="laptop"\] \.collectible__sprite::before/);
  assert.match(gameCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(checkoutJs, /himawari-game-coupon-v1/);
  assert.match(checkoutJs, /게임 획득/);
});

test('이용약관에 확정된 배송·반품·고객센터 정보를 표시한다', async () => {
  const html = await readFile(new URL('../terms.html', import.meta.url), 'utf8');

  assert.equal((html.match(/<h2>제\d+조/g) || []).length, 24);
  assert.equal(html.includes('golf4484@naver.com'), true);
  assert.equal(html.includes('로젠택배'), true);
  assert.equal(html.includes('기본 배송비는 3,500원'), true);
  assert.equal(html.includes('100,000원 이상은 무료배송'), true);
  assert.equal(html.includes('편도·왕복 반품비는 8,000원'), true);
  assert.equal(html.includes('배곧4로 32-29, 파크뷰 206호 히마와리 코리아'), true);
});

test('존재하지 않는 제품은 로딩 대신 명확한 오류 페이지를 렌더링한다', async () => {
  const template = await readFile(new URL('../templates/product.html', import.meta.url), 'utf8');
  const html = renderProductNotFoundPage(template);

  assert.match(html, /<title>제품을 찾을 수 없습니다 — Himawari<\/title>/);
  assert.match(html, /<section class="product-not-found" data-not-found>/);
  assert.match(html, /data-loading-state role="status" hidden/);
});

test('공개·주문·관리 화면은 quiet sage 디자인 토큰을 공유한다', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const gear = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');
  const orders = await readFile(new URL('../assets/orders.css', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../admin/admin.css', import.meta.url), 'utf8');

  assert.match(styles, /--color-sage-canvas:\s*#F3F7EF/);
  assert.match(styles, /--color-deep-grove:\s*#4F6B58/);
  assert.match(styles, /--color-sage-pop:\s*#D9E8D3/);
  assert.match(styles, /--radius-card:\s*24px/);
  assert.match(styles, /--radius-pill:\s*999px/);
  assert.match(styles, /font-family:\s*var\(--font-brand\)/);
  assert.match(gear, /\.store-product-card[\s\S]*border-radius:\s*var\(--radius-card\)/);
  assert.match(orders, /\.checkout-summary[\s\S]*border-radius:\s*var\(--radius-card/);
  assert.match(admin, /--harbor:\s*#4f6b58/);
  assert.match(admin, /--moss:\s*#d9e8d3/);
});
