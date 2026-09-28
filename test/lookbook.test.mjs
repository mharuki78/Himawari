import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateEntries, koreanDate, renderGallery, root } from '../scripts/build-lookbook.mjs';
const entries = JSON.parse(fs.readFileSync(`${root}/lookbook/entries.json`)).filter(e => e.date === '2026-09-28');
const options = {today:'2026-09-28',checkFiles:false};
test('Korean publication date changes at 15:00 UTC, not midnight UTC', () => {
  assert.equal(koreanDate(new Date('2026-09-27T14:59:59Z')), '2026-09-27');
  assert.equal(koreanDate(new Date('2026-09-27T15:00:00Z')), '2026-09-28');
});
test('rejects future dates, duplicate images/IDs, unsafe assets and incomplete days', () => {
  assert.doesNotThrow(() => validateEntries(entries, options));
  assert.throws(() => validateEntries(entries, {...options,today:'2026-09-27'}), /Future/);
  assert.throws(() => validateEntries([entries[0],entries[0]], options), /Duplicate/);
  assert.throws(() => validateEntries([entries[0],{...entries[1],image:entries[0].image}], options), /Reused/);
  assert.throws(() => validateEntries([{...entries[0],thumbnail:'/assets/lookbook/../../secret.webp'},entries[1]], options));
  assert.throws(() => validateEntries([entries[0]], options), /2–3/);
});
test('static gallery keeps full image/product links without JavaScript and escapes content', () => {
  const html = renderGallery([{...entries[0],title:'<img src=x onerror="bad()">',scene:'" onclick="bad()'}]);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('data-scene="" onclick='));
  assert.ok(html.includes(`href="${entries[0].image}"`));
  assert.ok(html.includes(`href="/product.html?id=${entries[0].productId}"`));
});
