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
  const organization = blocks.find(b => b['@type'] === 'Organization');
  const page = blocks.find(b => b['@type'] === 'WebPage');
  assert.equal(page.publisher['@id'], organization['@id']);
  assert.ok(section.includes(`datetime="${page.dateModified}"`));
  assert.match(html.match(/<h1[\s\S]*?<\/h1>/)[0], /히마와리 Himawari/);
  const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(description.length >= 50 && description.length <= 160);
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
