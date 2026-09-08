import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('홈 화면의 제품 여정·게임 미리보기·릴스 진행 표시가 연결된다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');
  const journalImage = await readFile(new URL('../assets/journal-0514-silver.webp', import.meta.url));

  assert.match(html, /data-bag-journey/);
  assert.match(html, /assets\/game-0422-black\.jpg/);
  assert.match(html, /data-game-preview/);
  assert.match(html, /data-reel-progress[^>]+role="progressbar"/);
  assert.match(script, /function initializeBagJourney\(\)/);
  assert.match(script, /function initializeGamePreview\(\)/);
  assert.match(script, /function updateReelProgress\(\)/);
  assert.match(css, /\.journal::before\s*\{[\s\S]*journal-0514-silver\.webp/);
  assert.doesNotMatch(css, /\.journal::before\s*\{[\s\S]{0,160}himawari-collection-v2\.webp/);
  assert.ok(journalImage.byteLength > 50_000);
});

test('제품 옵션·상세 포인트·장바구니 성공 피드백이 접근 가능한 상태를 유지한다', async () => {
  const products = await readFile(new URL('../products.js', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../product-detail.js', import.meta.url), 'utf8');
  const cart = await readFile(new URL('../assets/cart.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');

  assert.match(products, /function transitionProductCardMedia\(article, product\)/);
  assert.match(products, /article\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(detail, /function configureProductHotspots\(product\)/);
  assert.match(detail, /button\.setAttribute\('aria-pressed'/);
  assert.match(cart, /himawari:cart-added/);
  assert.match(cart, /if \(b\.dataset && b\.dataset\.rdcartBusy\) return;[\s\S]+var added = add\(/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.rdcart-flight/);
});
