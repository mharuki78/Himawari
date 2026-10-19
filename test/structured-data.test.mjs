import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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

test('제품명에 명시된 추가 색상도 상품군의 필수 색상 값으로 제공한다', () => {
  for (const color of ['피치', '라벤더', '스카이', '버건디', '코랄']) {
    const variant = { ...black, id: `bag-${color}`, name: `히마와리 No.2513 ${color}` };
    const graph = parse(renderProductPage(template, black, origin, null, [black, variant]));
    assert.equal(graph.find(n => n.sku === variant.id).color, color);
    assert.deepEqual(graph.find(n => n['@type'] === 'ProductGroup').variesBy, ['https://schema.org/color']);
  }
});

test('체스트벨트 세트 구성은 일반 가방의 색상 변형으로 묶지 않는다', () => {
  const bundle = { ...black, id: 'bag-set', name: '히마와리 No.2513+체스트벨트 SET' };
  const family = [black, mint, bundle];
  const graph = parse(renderProductPage(template, black, origin, null, family));
  assert.deepEqual(graph.find(n => n['@type'] === 'ProductGroup').hasVariant.map(n => n['@id']).sort(), [black, mint].map(p => `${origin}/product.html?id=${p.id}#product`).sort());
  assert.ok(!graph.some(n => n.sku === bundle.id));
  const bundleGraph = parse(renderProductPage(template, bundle, origin, null, family));
  assert.ok(!bundleGraph.some(n => n['@type'] === 'ProductGroup'));
  assert.equal(bundleGraph.find(n => n.sku === bundle.id).isVariantOf, undefined);
  assert.equal(bundleGraph.find(n => n['@type'] === 'WebPage').mainEntity['@id'], `${origin}/product.html?id=bag-set#product`);
});

test('색상이 확인되지 않은 상품에는 임의 색상이나 불완전한 상품군 관계를 만들지 않는다', () => {
  const unknown = { ...black, id: 'bag-unknown', name: '히마와리 No.2513' };
  const family = [black, mint, unknown];
  const graph = parse(renderProductPage(template, black, origin, null, family));
  const group = graph.find(n => n['@type'] === 'ProductGroup');
  assert.ok(group.description);
  for (const reference of group.hasVariant) {
    const variant = graph.find(n => n['@id'] === reference['@id']);
    for (const property of group.variesBy) assert.ok(variant[property.split('/').at(-1)]);
  }
  assert.ok(!graph.some(n => n.sku === unknown.id));
  const standalone = parse(renderProductPage(template, unknown, origin, null, family));
  assert.ok(!standalone.some(n => n['@type'] === 'ProductGroup'));
  assert.equal(standalone.find(n => n.sku === unknown.id).color, undefined);
  assert.equal(standalone.find(n => n.sku === unknown.id).isVariantOf, undefined);
});

test('상품 텍스트에 script 종료 문자열이 있어도 JSON-LD 밖으로 빠져나오지 않는다', () => {
  const name = '가방 </script><script>alert(1)</script>';
  const graph = parse(renderProductPage(template, { ...black, name }));
  assert.equal(graph.find(n => n.sku === black.id).name, name);
});

test('상세페이지는 선택한 상품과 탐색경로를 같은 WebPage에 연결한다', () => {
  const graph = parse(renderProductPage(template, mint, origin, null, [black, mint]));
  const page = graph.find(n => n['@type'] === 'WebPage');
  const product = graph.find(n => n.sku === mint.id);
  assert.ok(page, 'Missing product WebPage');
  assert.equal(page.url, origin + '/product.html?id=bag-mint');
  assert.equal(page.mainEntity['@id'], product['@id']);
  assert.equal(product.mainEntityOfPage['@id'], page['@id']);
  assert.equal(page.breadcrumb['@id'], graph.find(n => n['@type'] === 'BreadcrumbList')['@id']);
  assert.equal(product.offers.seller['@id'], origin + '/#organization');
});

test('이전 이야기 경로도 표시된 사진·편집팀·실제 수정일을 설명한다', () => {
  const appended = [];
  const context = {
    URL,
    location: new URL(origin + '/story/post.html?id=behind-package-20260829'),
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {} }),
      head: { append: element => appended.push(element) },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../story/blog.js', import.meta.url), 'utf8'), context);
  context.post = { id: 'behind-package-20260829', url: 'behind-package.html', title: '가방의 포장을 열고 첫 짐을 담는 시간', author: '히마와리 편집팀', date: '2026-08-14', dateModified: '2026-10-14', image: '../assets/story/himawari-package-process.webp', images: ['not-rendered.webp'] };
  vm.runInContext('setPostMeta(post)', context);
  const graph = appended.filter(s => s.type === 'application/ld+json').map(s => JSON.parse(s.textContent));
  const article = graph.find(n => n['@type'] === 'BlogPosting');
  assert.equal(article.datePublished, '2026-08-14');
  assert.equal(article.dateModified, '2026-10-14');
  assert.equal(article['@id'], origin + '/story/behind-package.html#article');
  assert.equal(article.url, origin + '/story/behind-package.html');
  assert.equal(article.author['@type'], 'Organization');
  assert.equal(article.author.url, origin + '/');
  assert.equal(article.publisher['@id'], origin + '/#organization');
  assert.equal(article.publisher.logo.url, origin + '/assets/himawari-logo-hq.png');
  assert.equal(article.inLanguage, 'ko-KR');
  assert.deepEqual(article.image, [origin + '/assets/story/himawari-package-process.webp']);
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
    assert.equal(article.datePublished, post.publishedAt || post.date);
    assert.equal(article.dateModified, post.modifiedAt || post.dateModified || post.date);
    assert.ok(article.image.length >= 2);
  }
});

test('확인된 이야기 시각만 반영하고 날짜·시간대가 모순되면 중단한다', async () => {
  const { updateStorySchema } = await import('../scripts/lib/story-schema.mjs');
  const data = { '@type': 'BlogPosting', datePublished: '2026-10-18', dateModified: '2026-10-18' };
  const html = `<link rel="canonical" href="${origin}/story/example.html"><script type="application/ld+json">${JSON.stringify(data)}</script><article><p>원래 본문</p></article>`;
  const post = { date: '2026-10-18', publishedAt: '2026-10-18T08:42:33+09:00', modifiedAt: '2026-10-18T08:44:53.219+09:00' };
  const result = updateStorySchema(html, post);
  const article = parse(result)[0];
  assert.equal(article.datePublished, post.publishedAt);
  assert.equal(article.dateModified, post.modifiedAt);
  assert.equal(result.match(/<article>[\s\S]*<\/article>/)[0], '<article><p>원래 본문</p></article>');
  assert.equal(updateStorySchema(result, post), result);
  for (const publishedAt of ['2026-10-18T08:42:33', '2026-10-17T08:42:33+09:00', 'not-a-date']) {
    assert.throws(() => updateStorySchema(html, { ...post, publishedAt }), /publishedAt/);
  }
  assert.throws(() => updateStorySchema(html, { ...post, modifiedAt: '2026-10-18T08:41:00+09:00' }), /before publication/);
  assert.equal(parse(updateStorySchema(html, { date: post.date }))[0].datePublished, post.date);
});
