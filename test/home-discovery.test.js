import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import faq from '../data/home-faq.json' with { type: 'json' };

test('homepage FAQ schema matches visible, usable answers and real internal links', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(m => JSON.parse(m[1]));
  const schema = blocks.find(b => b['@type'] === 'FAQPage');
  assert.equal(schema.mainEntity.length, faq.length);
  const section = html.match(/<section class="home-faq section"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  for (const [i, entry] of faq.entries()) {
    assert.equal(schema.mainEntity[i].name, entry.question);
    assert.equal(schema.mainEntity[i].acceptedAnswer.text, entry.answer);
    assert.ok(section.includes(`<summary>${entry.question}</summary>`));
    assert.ok(section.includes(`<p>${entry.answer}</p>`));
    assert.ok(section.includes(`href="${entry.link}"`));
    if (entry.link === '/products.html') {
      const routes = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
      assert.ok(routes.rewrites.some(r => r.source === entry.link && r.destination === '/api/storefront?page=catalog'));
      await readFile(new URL('../templates/products.html', import.meta.url));
    } else await readFile(new URL('..' + entry.link, import.meta.url));
  }
  const organization = blocks.find(b => ['Organization', 'OnlineStore'].includes(b['@type']));
  const page = blocks.find(b => b['@type'] === 'WebPage');
  assert.equal(page.publisher['@id'], organization['@id']);
  // A section's review date does not establish the homepage's last content change.
  if (schema.dateModified) assert.ok(section.includes(`datetime="${schema.dateModified}"`));
  assert.match(html.match(/<h1[\s\S]*?<\/h1>/)[0], /히마와리 Himawari/);
  const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(description.length >= 50 && description.length <= 160);
});

test('homepage identifies the online store with the business contact details shown in its footer', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const store = blocks.find(b => b['@type'] === 'OnlineStore');
  assert.ok(store, 'Missing OnlineStore business identity');
  assert.equal(store['@id'], 'https://himawari.co.kr/#organization');
  assert.equal(store.telephone, '+82-10-8447-6271');
  assert.equal(store.email, 'nys9980@himawari.co.kr');
  assert.equal(store.address['@type'], 'PostalAddress');
  assert.equal(store.address.streetAddress, '경기도 시흥시 배곧4로 32-29, 파크뷰 206호');
  assert.equal(store.address.addressRegion, '경기도');
  assert.equal(store.address.addressLocality, '시흥시');
  assert.equal(store.address.addressCountry, 'KR');
  assert.equal(store.address.postalCode, '15010');
  const poster = html.match(/<video\b[^>]*poster="([^"]+)"/)?.[1];
  assert.equal(store.image, new URL(poster, 'https://himawari.co.kr/').href);
  const site = blocks.find(b => b['@type'] === 'WebSite');
  const shareImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const shareName = html.match(/<meta property="og:site_name" content="([^"]+)"/)?.[1];
  assert.equal(shareImage, store.image, 'Sharing image must match the current visible campaign and store image');
  assert.equal(shareName, site.name, 'Sharing site name must match WebSite identity');
  assert.ok((await readFile(new URL('../' + poster, import.meta.url))).byteLength > 0);
  assert.ok(html.includes(store.address.streetAddress));
});

test('feed discovery points to a real RSS feed and meaningful product image has alt text', async () => {
  for (const file of ['index.html', 'about.html', 'story/index.html']) {
    const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(html, /rel="alternate" type="application\/rss\+xml"[^>]+href="https:\/\/himawari.co.kr\/feed.xml"/);
  }
  assert.match(await readFile(new URL('../feed.xml', import.meta.url), 'utf8'), /<rss version="2.0">/);
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /src="assets\/game-0422-black.jpg"[^>]+alt="히마와리 No.0422/);
});
