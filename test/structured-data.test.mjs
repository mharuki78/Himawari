import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderProductPage } from '../api/_lib/storefront.js';

const origin = 'https://himawari.co.kr';
const template = fs.readFileSync(new URL('../templates/product.html', import.meta.url), 'utf8');
const parse = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => {
  const data = JSON.parse(m[1]);
  return data['@graph'] || [data];
});
const black = { id: 'bag-black', model: 'No.2513', name: '히마와리 No.2513 블랙', price: 64900, soldOut: false, image: 'https://images.example/black.jpg', gallery: [], tagline: '검정 가방', specs: { dimensions: '36.5 × 28 × 2 cm' } };
const mint = { ...black, id: 'bag-mint', name: '히마와리 No.2513 민트', image: 'https://images.example/mint.jpg', soldOut: true };

test('상품 구조화 데이터는 현재 상품 경로와 실제 가격·품절 상태를 사용한다', () => {
  const graph = parse(renderProductPage(template, mint, origin, null, [black, mint]));
  const product = graph.find(n => n.sku === mint.id);
  const breadcrumb = graph.find(n => n['@type'] === 'BreadcrumbList');
  assert.ok(breadcrumb, 'Missing product breadcrumb');
  assert.deepEqual(breadcrumb.itemListElement.map(i => i.item), [origin + '/products.html', origin + '/product.html?id=bag-mint']);
  assert.equal(product.offers.url, origin + '/product.html?id=bag-mint');
  assert.equal(product.offers.price, '64900');
  assert.equal(product.offers.priceCurrency, 'KRW');
  assert.equal(product.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(product.offers.seller.name, '히마와리 코리아');
  assert.equal(product.offers.shippingDetails.deliveryTime?.handlingTime?.maxValue, 2, 'Preserve the published dispatch deadline');
  assert.equal(product.offers.shippingDetails.deliveryTime?.transitTime, undefined, 'Do not invent unverified carrier transit days');
  assert.equal(product.aggregateRating, undefined, 'No fabricated ratings for unrated product');
});

test('상품군은 확인된 색상·실측 차이만 변형 기준으로 선언한다', () => {
  const sameSize = parse(renderProductPage(template, black, origin, null, [black, mint]));
  assert.deepEqual(sameSize.find(n => n['@type'] === 'ProductGroup').variesBy, ['https://schema.org/color']);
  const smaller = { ...mint, specs: { dimensions: '30 × 22 × 2 cm' } };
  const differentSize = parse(renderProductPage(template, black, origin, null, [black, smaller]));
  assert.deepEqual(differentSize.find(n => n['@type'] === 'ProductGroup').variesBy, ['https://schema.org/color', 'https://schema.org/size']);
  assert.equal(differentSize.find(n => n.sku === 'bag-mint').size, '30 × 22 × 2 cm');
  const single = parse(renderProductPage(template, black));
  assert.ok(!single.some(n => n['@type'] === 'ProductGroup'), 'Single product does not claim variants');
  assert.equal(single.find(n => n.sku === black.id).isVariantOf, undefined);
});

test('상품 텍스트에 script 종료 문자열이 있어도 JSON-LD 밖으로 빠져나오지 않는다', () => {
  const name = '가방 </script><script>alert(1)</script>';
  const graph = parse(renderProductPage(template, { ...black, name }));
  assert.equal(graph.find(n => n.sku === black.id).name, name);
});

test('이야기 보완은 표시된 사진과 발행자 연결을 추가하고 본문·발행일을 보존한다', async () => {
  const { updateStorySchema } = await import('../scripts/lib/story-schema.mjs').catch(() => ({}));
  assert.equal(typeof updateStorySchema, 'function', 'Missing reusable story schema updater');
  const article = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: '가방 입구 읽기', datePublished: '2026-09-01', dateModified: '2026-10-14', author: { '@type': 'Organization', name: '히마와리 편집팀' }, image: [origin + '/assets/hero.webp'], mainEntityOfPage: origin + '/story/bag.html' };
  const html = `<html><head><link rel="canonical" href="${origin}/story/bag.html"><script type="application/ld+json">${JSON.stringify(article)}</script></head><body><article><h1>가방 입구 읽기</h1><img src="../assets/hero.webp"><p>가방의 입구를 살펴보는 본문.</p><img src="../assets/detail.webp"><img src="../assets/actual.webp"><img src="../assets/detail.webp"></article><footer><img src="/assets/logo.png"></footer></body></html>`;
  const result = updateStorySchema(html);
  const data = parse(result).find(n => n['@type'] === 'BlogPosting');
  assert.equal(data.datePublished, '2026-09-01');
  assert.equal(data.dateModified, '2026-10-14');
  assert.equal(data.publisher.url, origin + '/');
  assert.equal(data.publisher.logo.url, origin + '/assets/himawari-logo-hq.png');
  assert.equal(data.author.url, origin + '/');
  assert.equal(data.inLanguage, 'ko-KR');
  assert.equal(data['@id'], origin + '/story/bag.html#article');
  assert.deepEqual(data.image, [origin + '/assets/hero.webp', origin + '/assets/detail.webp', origin + '/assets/actual.webp']);
  assert.equal(result.slice(result.indexOf('<body>')), html.slice(html.indexOf('<body>')));
  assert.equal(updateStorySchema(result), result, 'Repeat run must be idempotent');
});

test('모든 발행된 이야기에는 발행자·작성자 링크와 본문 사진이 연결된다', () => {
  const posts = JSON.parse(fs.readFileSync(new URL('../story/posts.json', import.meta.url)));
  for (const post of posts) {
    const html = fs.readFileSync(new URL('../story/' + post.url, import.meta.url), 'utf8');
    const article = parse(html).find(n => n['@type'] === 'BlogPosting');
    assert.equal(article?.publisher?.url, origin + '/', post.url + ': publisher');
    assert.equal(article?.author?.url, origin + '/', post.url + ': author');
    assert.equal(article?.inLanguage, 'ko-KR', post.url + ': language');
    assert.equal(article?.url, origin + '/story/' + post.url);
    assert.equal(article.datePublished, post.date);
    assert.equal(article.dateModified, post.dateModified || post.date);
    assert.ok(article.image.length >= 2);
  }
});
