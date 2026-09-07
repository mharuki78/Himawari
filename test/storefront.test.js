import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { fetch as productsHandler } from '../api/products.js';
import { publicProduct, seedCatalog } from '../api/_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from '../api/_lib/storefront.js';

const products = seedCatalog().products.map(publicProduct);

test('모든 HTML 페이지와 상품 템플릿이 공통 파비콘을 선언한다', async () => {
  const rootFiles = ['about.html', 'account.html', 'checkout.html', 'contact.html', 'game.html', 'index.html', 'privacy.html', 'terms.html'];
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

test('홈 첫 화면은 No.1884 도시형 히어로 영상과 릴스 8개를 제공한다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const gearCss = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');

  assert.match(html, /class="home-film-hero__video"[^>]+poster="assets\/hero-products-motion-poster\.png"/);
  assert.match(html, /<source src="assets\/hero-products-motion\.mp4" type="video\/mp4">/);
  assert.match(html, /No\.1884 백팩을 착용한 직장인이 도심을 걷는 모습/);
  assert.match(html, /class="home-film-hero__toggle"[^>]+data-ambient-toggle/);
  assert.doesNotMatch(html, /class="home-film-hero__image"/);
  assert.equal((html.match(/data-reel-card/g) || []).length, 8);
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
    'books-documents-backpack-packing',
    'backpack-lining-cleaning-guide',
    'train-travel-backpack-guide',
  ];

  assert.deepEqual(posts.slice(0, 3).map((post) => post.id), slugs);

  for (const slug of slugs) {
    const post = posts.find((entry) => entry.id === slug);
    const html = await readFile(new URL(`../story/${slug}.html`, import.meta.url), 'utf8');
    const imagePath = post.image.replace('../', '');

    assert.equal(post.date, '2026-09-07');
    await access(new URL(`../${imagePath}`, import.meta.url));
    assert.match(html, new RegExp(`<link rel="canonical" href="https://allaboutbag\\.com/story/${slug}\\.html">`));
    assert.match(html, new RegExp(`<meta property="og:image" content="https://allaboutbag\\.com/assets/story/${slug}\\.webp">`));
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /class="story-related"/);
    assert.match(html, /class="story-faq"/);
    assert.equal(sitemap.includes(`https://allaboutbag.com/story/${slug}.html`), true);
    assert.equal(feed.includes(`https://allaboutbag.com/story/${slug}.html`), true);
  }
});

test('상품 목록 원본 HTML에 전체 카탈로그와 구조화 데이터를 렌더링한다', async () => {
  const template = await readFile(new URL('../templates/products.html', import.meta.url), 'utf8');
  const html = renderCatalogPage(template, products);

  assert.equal((html.match(/data-server-rendered-product/g) || []).length, 34);
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
      sitemap.includes(`https://allaboutbag.com/product.html?id=${encodeURIComponent(product.id)}`),
      true,
      `${product.id}: sitemap product URL`,
    );
  }
});

test('운영 사이트맵은 현재 제품과 이야기 목록을 XML로 동적 제공한다', async () => {
  const response = await productsHandler(new Request('https://allaboutbag.com/api/products?route=sitemap'));
  const sitemap = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/xml/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 65);
  for (const product of products) {
    assert.equal(sitemap.includes(`https://allaboutbag.com/product.html?id=${encodeURIComponent(product.id)}`), true);
  }
  assert.equal(sitemap.includes('https://allaboutbag.com/story/books-documents-backpack-packing.html'), true);
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

test('홈 제품 영역은 모든 카드에 Npay 버튼을 요청한다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-npay-cards/g) || []).length, 2);
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

test('전체 제품 페이지는 대표 상품과 모든 제품 카드에 Npay 버튼을 요청한다', async () => {
  const template = await readFile(new URL('../templates/products.html', import.meta.url), 'utf8');
  const html = renderCatalogPage(template, products);

  assert.equal((html.match(/data-npay-cards/g) || []).length, 2);
  assert.equal((html.match(/data-server-rendered-product/g) || []).length, 34);
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
  const gameCss = await readFile(new URL('../assets/game.css', import.meta.url), 'utf8');
  const checkoutJs = await readFile(new URL('../assets/checkout.js', import.meta.url), 'utf8');

  await access(new URL('../assets/game-pixel-school-world.png', import.meta.url));
  await access(new URL('../assets/game-pixel-player.png', import.meta.url));
  assert.match(html, /data-game-panel="catch"/);
  assert.match(html, /data-game-panel="pack"/);
  assert.match(html, /data-game-panel="result"/);
  assert.match(html, /assets\/game-pixel-school-world\.png/);
  assert.match(html, /assets\/game-pixel-player\.png/);
  assert.match(html, /data-game-move="up"/);
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
