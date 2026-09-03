import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { publicProduct, seedCatalog } from '../api/_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from '../api/_lib/storefront.js';

const products = seedCatalog().products.map(publicProduct);

test('상품 목록 원본 HTML에 전체 카탈로그와 구조화 데이터를 렌더링한다', async () => {
  const template = await readFile(new URL('../products.html', import.meta.url), 'utf8');
  const html = renderCatalogPage(template, products);

  assert.equal((html.match(/data-server-rendered-product/g) || []).length, 34);
  assert.match(html, /히마와리 학생가방 책가방 데일리 백팩 No\.1027/);
  assert.match(html, /"numberOfItems":34/);
  assert.doesNotMatch(html, /SERVER_CATALOG_SCHEMA|SERVER_FEATURED_PRODUCT|SERVER_PRODUCT_GRID/);
  assert.doesNotMatch(html, /제품을 불러오는 중입니다/);
  assert.match(html, /<strong data-product-count>34<\/strong>/);
});

test('개별 제품 원본 HTML에 이름·가격·이미지·구매정보를 렌더링한다', async () => {
  const template = await readFile(new URL('../product.html', import.meta.url), 'utf8');
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
  assert.equal(html.includes('golf484@naver.com'), true);
});

test('이용약관에 확정된 배송·반품·고객센터 정보를 표시한다', async () => {
  const html = await readFile(new URL('../terms.html', import.meta.url), 'utf8');

  assert.equal((html.match(/<h2>제\d+조/g) || []).length, 24);
  assert.equal(html.includes('golf484@naver.com'), true);
  assert.equal(html.includes('로젠택배'), true);
  assert.equal(html.includes('기본 배송비는 3,500원'), true);
  assert.equal(html.includes('100,000원 이상은 무료배송'), true);
  assert.equal(html.includes('편도·왕복 반품비는 8,000원'), true);
  assert.equal(html.includes('배곧4로 32-29, 파크뷰 206호 히마와리 코리아'), true);
});

test('존재하지 않는 제품은 로딩 대신 명확한 오류 페이지를 렌더링한다', async () => {
  const template = await readFile(new URL('../product.html', import.meta.url), 'utf8');
  const html = renderProductNotFoundPage(template);

  assert.match(html, /<title>제품을 찾을 수 없습니다 — Himawari<\/title>/);
  assert.match(html, /<section class="product-not-found" data-not-found>/);
  assert.match(html, /data-loading-state role="status" hidden/);
});
