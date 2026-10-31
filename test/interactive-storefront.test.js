import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('홈 화면의 제품 여정·두 번째 게임·릴스 진행 표시가 연결된다', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');
  const journalImage = await readFile(new URL('../assets/journal-0514-silver.webp', import.meta.url));

  assert.match(html, /data-bag-journey/);
  assert.match(html, /assets\/game-0422-black\.jpg/);
  const game = html.match(/<section class="game-invite"[\s\S]*?<\/section>/)?.[0];
  assert.ok(game);
  assert.match(game, /class="home-button home-button--primary" href="rhythm.html"/);
  assert.match(game, /src="assets\/rhythm-1884.webp"/);
  assert.match(game, /href="game.html"/);
  assert.doesNotMatch(game, /data-game-preview|game-pixel-school-world/);
  await readFile(new URL('../assets/rhythm-1884.webp', import.meta.url));
  const sections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(sections.slice(0, 2), ['home', 'daily-film']);
  assert.match(html, /data-reel-progress[^>]+role="progressbar"/);
  assert.match(script, /function initializeBagJourney\(\)/);
  assert.match(script, /function updateReelProgress\(\)/);
  assert.match(css, /\.journal::before\s*\{[\s\S]*journal-0514-silver\.webp/);
  assert.doesNotMatch(css, /\.journal::before\s*\{[\s\S]{0,160}himawari-collection-v2\.webp/);
  assert.ok(journalImage.byteLength > 50_000);
});

test('제품 옵션과 장바구니 성공 피드백이 접근 가능한 상태를 유지한다', async () => {
  const products = await readFile(new URL('../products.js', import.meta.url), 'utf8');
  const cart = await readFile(new URL('../assets/cart.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../assets/gear.css', import.meta.url), 'utf8');

  assert.match(products, /function transitionProductCardMedia\(article, product\)/);
  assert.match(products, /article\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(cart, /himawari:cart-added/);
  assert.match(cart, /if \(b\.dataset && b\.dataset\.rdcartBusy\) return;[\s\S]+var added = add\(/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.rdcart-flight/);
});
