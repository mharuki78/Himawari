import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { publicProduct, seedCatalog } from '../api/_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from '../api/_lib/storefront.js';

const products = seedCatalog().products.map(publicProduct);

test('모든 HTML 페이지와 상품 템플릿이 공통 파비콘을 선언한다', async () => {
  const rootFiles = ['about.html', 'account.html', 'checkout.html', 'contact.html', 'index.html', 'privacy.html', 'terms.html'];
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

test('홈 첫 화면은 정적 컬렉션 이미지를 쓰고 릴스 8개를 제공한다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const gearCss = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');

  assert.match(html, /class="home-film-hero__image"[^>]+src="assets\/himawari-collection-v2\.webp"/);
  assert.doesNotMatch(html, /hero-film-1884\.mp4|home-film-hero__video|home-film-hero__toggle/);
  assert.equal((html.match(/data-reel-card/g) || []).length, 8);
  assert.match(html, /assets\/reel-0514-260527\.mp4/);
  assert.match(html, /assets\/reel-0514-260604\.mp4/);
  assert.match(html, /assets\/reel-0424-260528\.mp4/);
  assert.match(html, /3 \/ 8 · No\.1884 영상/);
  assert.match(gearCss, /url\("himawari-logo-hq\.png"\)/);
  assert.doesNotMatch(gearCss, /url\("himawari-logo\.png"\)/);

  for (const asset of [
    'assets/himawari-logo-hq.png',
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
    'laptop-backpack-compartment-checklist',
    'backpack-zipper-hardware-care',
    'airplane-carry-on-backpack-packing',
  ];

  assert.deepEqual(posts.slice(0, 3).map((post) => post.id), slugs);

  for (const slug of slugs) {
    const post = posts.find((entry) => entry.id === slug);
    const html = await readFile(new URL(`../story/${slug}.html`, import.meta.url), 'utf8');
    const imagePath = post.image.replace('../', '');

    assert.equal(post.date, '2026-09-05');
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

test('개별 제품 원본 HTML에 이름·가격·이미지·구매정보를 렌더링한다', async () => {
  const template = await readFile(new URL('../templates/product.html', import.meta.url), 'utf8');
  const product = products[0];
  const html = renderProductPage(template, product);

  assert.match(html, new RegExp(`<article data-product-content>`));
  assert.equal(html.includes(product.name), true);
  assert.match(html, /76,800/);
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
