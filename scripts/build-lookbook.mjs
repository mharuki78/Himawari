import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { validateLookbookCount } from './lib/publication-schedule.mjs';

export const root = path.resolve(import.meta.dirname, '..');
export const koreanDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const labels = { city: '도시', travel: '여행', everyday: '일상' };
export function validateEntries(entries, { today = koreanDate(), checkFiles = true } = {}) {
  assert.ok(Array.isArray(entries) && entries.length > 0, 'LookBook entries required');
  const ids = new Set(), images = new Set(), dates = new Map();
  for (const entry of entries) {
    assert.match(entry.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
    assert.ok(!ids.has(entry.id), `Duplicate ID: ${entry.id}`); ids.add(entry.id);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10), entry.date);
    assert.ok(entry.date <= today, 'Future publication date');
    assert.ok(Object.hasOwn(labels, entry.category), 'Unknown category');
    for (const key of ['title', 'model', 'color', 'scene', 'alt']) assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `Missing ${key}`);
    assert.match(entry.productId, /^(?:store|coupang)-[a-z0-9]+$/);
    assert.ok(!images.has(entry.image), 'Reused image'); images.add(entry.image);
    for (const key of ['image', 'thumbnail']) {
      assert.match(entry[key], /^\/assets\/lookbook\/[a-z0-9-]+\.webp$/);
      if (checkFiles) assert.ok(fs.statSync(path.join(root, entry[key])).size > 1000, 'Missing image');
    }
    assert.equal(entry.width, 1024); assert.equal(entry.height, 1536);
    dates.set(entry.date, (dates.get(entry.date) || 0) + 1);
  }
  for (const [date, count] of dates) validateLookbookCount(date, count);
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}
const icon = kind => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${({ expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', prev: '<path d="m14 6-6 6 6 6"/>', next: '<path d="m10 6 6 6-6 6"/>' })[kind]}</svg>`;
export function renderGallery(entries) {
  const dates = [...new Set(entries.map(e => e.date))];
  return dates.map(date => `<section class="lookbook-day" aria-labelledby="day-${date}">
  <div class="lookbook-day-head"><h2 id="day-${date}"><time datetime="${date}">${date.replaceAll('-', '. ')}</time></h2><p>오늘의 장면</p></div>
  <div class="lookbook-grid" data-count="${entries.filter(e => e.date === date).length}">${entries.filter(e => e.date === date).map(entry => {
    const e = Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, escapeHtml(value)]));
    return `<figure class="lookbook-card" id="${e.id}" data-lookbook-card data-category="${e.category}" data-scene="${e.scene}" data-date="${e.date}">
    <a class="lookbook-photo" data-lookbook-open href="${e.image}" aria-label="${e.title} — 사진 크게 보기">
      <img src="${e.thumbnail}" srcset="${e.thumbnail} 640w, ${e.image} 1024w" sizes="(max-width: 820px) calc(100vw - 40px), (max-width: 1264px) 30vw, 382px" width="1024" height="1536" alt="${e.alt}" ${entry === entries[0] ? 'fetchpriority="high" loading="eager"' : 'loading="lazy"'} decoding="async">
      <span class="lookbook-expand" aria-hidden="true">${icon('expand')}</span>
    </a><figcaption><h3>${e.title}</h3><p data-model>No.${e.model} · ${e.color} <span aria-hidden="true">/</span> ${labels[entry.category]}</p>
      <a class="lookbook-product" href="/product.html?id=${e.productId}" aria-label="No.${e.model} 제품 보기">이 가방 보기 ${icon('arrow')}</a>
    </figcaption></figure>`;
  }).join('\n')}</div></section>`).join('\n');
}
export function buildLookbook() {
  const entries = validateEntries(JSON.parse(fs.readFileSync(path.join(root, 'lookbook/entries.json'), 'utf8')));
  const shell = fs.readFileSync(path.join(root, 'story/index.html'), 'utf8');
  let header = shell.match(/    <div class="announcement-bar">[\s\S]*?<\/header>/)[0].replaceAll('../', '/');
  header = header.replace('<a href="/game.html">', '<a href="/lookbook/" aria-current="page">LookBook</a><a href="/game.html">');
  let footer = shell.match(/    <footer class="site-footer">[\s\S]*?<\/footer>/)[0].replaceAll('../', '/');
  footer = footer.replace('href="index.html" aria-current="page"', 'href="/story/"').replace('<a href="/contact.html">연락하기</a></nav>', '<a href="/lookbook/" aria-current="page">LookBook</a><a href="/contact.html">연락하기</a></nav>');
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ImageGallery', name: 'Himawari LookBook', url: 'https://himawari.co.kr/lookbook/', description: '히마와리 가방을 여러 옷차림에 매치한 사진. 실제 제품을 참고한 AI 착용 연출입니다.', dateModified: entries[0].date, image: entries.slice(0, 3).map(e => `https://himawari.co.kr${e.image}`) }).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="ko"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LookBook — Himawari</title>
  <meta name="description" content="히마와리 가방을 여러 옷차림에 매치한 LookBook입니다. 일상과 여행 코디를 실제 제품을 참고한 AI 착용 사진으로 둘러보세요.">
  <meta name="theme-color" content="#F3F7EF"><link rel="canonical" href="https://himawari.co.kr/lookbook/">
  <meta property="og:type" content="website"><meta property="og:title" content="LookBook — Himawari">
  <meta property="og:description" content="히마와리 가방을 여러 옷차림에 매치해 봤어요. 실제 제품을 참고한 AI 착용 사진으로 일상과 여행 코디를 둘러보세요.">
  <meta property="og:url" content="https://himawari.co.kr/lookbook/"><meta property="og:image" content="https://himawari.co.kr${entries[0].image}">
  <link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/gear.css"><link rel="stylesheet" href="/assets/cart.css"><link rel="stylesheet" href="/assets/member.css"><link rel="stylesheet" href="/lookbook/lookbook.css">
  <script src="/script.js" defer></script><script src="/lookbook/lookbook.js" defer></script>
  <script type="application/ld+json">${schema}</script>
  <script src="https://wcs.naver.net/wcslog.js"></script><script src="/assets/naver-inflow.js"></script>
</head><body class="lookbook-page"><a class="skip-link" href="#main">본문으로 바로가기</a>
${header}
<main id="main" class="lookbook-main">
  <div class="lookbook-intro"><h1>LookBook</h1><p>여러 옷차림에 히마와리 가방을 매치해 봤어요.<br>사진을 보며 마음에 드는 코디를 찾아보세요.</p></div>
  <div class="lookbook-toolbar" data-lookbook-toolbar hidden><div class="lookbook-filters" role="group" aria-label="장면 선택">
    <button type="button" data-lookbook-filter="all" aria-pressed="true">전체</button>${Object.entries(labels).map(([key, label]) => `<button type="button" data-lookbook-filter="${key}" aria-pressed="false">${label}</button>`).join('')}
  </div><p class="lookbook-status" data-lookbook-status role="status" aria-live="polite"></p></div>
  <div data-lookbook-gallery>${renderGallery(entries)}</div>
  <div class="lookbook-empty" data-lookbook-empty hidden><p>이 장면의 사진은 아직 준비 중입니다.</p><button type="button" data-lookbook-reset>전체 장면 보기</button></div>
  <button class="lookbook-more" type="button" data-lookbook-more hidden>이전 사진 더 보기</button>
</main>
<dialog class="lookbook-viewer" data-lookbook-viewer aria-labelledby="viewer-title">
  <button class="lookbook-viewer-close" type="button" data-lookbook-close aria-label="사진 닫기">${icon('close')}</button>
  <div class="lookbook-viewer-layout"><img class="lookbook-viewer-image" width="1024" height="1536" alt="">
    <div class="lookbook-viewer-copy"><p data-lookbook-date></p><h2 id="viewer-title"></h2><p data-lookbook-model></p><p data-lookbook-scene></p>
      <a class="lookbook-product" data-lookbook-product>이 가방 자세히 보기 ${icon('arrow')}</a>
      <div class="lookbook-viewer-controls"><button type="button" data-lookbook-prev aria-label="이전 사진">${icon('prev')}</button><span class="lookbook-viewer-counter" data-lookbook-counter role="status" aria-live="polite"></span><button type="button" data-lookbook-next aria-label="다음 사진">${icon('next')}</button></div>
      <p class="lookbook-disclosure">AI 착용 연출 이미지 · 실제 고객 착용 사진이 아닙니다.</p>
    </div></div>
</dialog>
${footer}
<script src="/assets/cart.js" defer></script><script src="/assets/member.js" defer></script>
<script>if(window.wcs_do) window.wcs_do();</script>
</body></html>
`;
  fs.writeFileSync(path.join(root, 'lookbook/index.html'), html);
  const sitemapPath = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/\s*<url><loc>https:\/\/himawari\.co\.kr\/lookbook\/<\/loc>[\s\S]*?<\/url>/g, '');
  sitemap = sitemap.replace('</urlset>', `  <url><loc>https://himawari.co.kr/lookbook/</loc><lastmod>${entries[0].date}</lastmod></url>\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(`Built LookBook: ${entries.length} photos across ${new Set(entries.map(e => e.date)).size} days`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) buildLookbook();
