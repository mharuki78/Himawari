import { json, methodNotAllowed } from './_lib/http.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './_lib/products.js';
import { publicPromotions, readPromotions } from './_lib/promotions.js';
import storyPosts from '../story/posts.json' with { type: 'json' };

const SITE_ORIGIN = 'https://allaboutbag.com';
const SITEMAP_PAGES = [
  ['/', '2026-09-07'],
  ['/about.html', '2026-08-29'],
  ['/products.html', '2026-09-03'],
  ['/contact.html', '2026-08-29'],
  ['/game.html', '2026-09-06'],
  ['/privacy.html', '2026-09-03'],
  ['/terms.html', '2026-09-03'],
  ['/story/', '2026-09-07'],
];

function sitemapUrl(path, lastmod = '') {
  const modified = /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : '';
  return `  <url><loc>${SITE_ORIGIN}${path}</loc>${modified}</url>`;
}

async function fetchSitemap(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
    const pages = SITEMAP_PAGES.map(([path, lastmod]) => sitemapUrl(path, lastmod));
    const products = catalog.products.map((product) => sitemapUrl(`/product.html?id=${encodeURIComponent(product.id)}`));
    const stories = storyPosts
      .filter((post) => post && post.id)
      .map((post) => sitemapUrl(`/story/${encodeURIComponent(post.id)}.html`, post.date));
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...pages,
      ...products,
      ...stories,
      '</urlset>',
      '',
    ].join('\n');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('public_sitemap_read_failed', { message: error.message || 'unknown error' });
    return new Response('사이트맵을 준비하지 못했습니다.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

async function fetchPromotions(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const { config } = await readPromotions();
    return json(publicPromotions(config));
  } catch (error) {
    console.error('public_promotions_read_failed', { message: error.message || 'unknown error' });
    return json({ message: '프로모션 정보를 불러오지 못했습니다.' }, 500);
  }
}

export async function fetch(request) {
  const route = new URL(request.url).searchParams.get('route');
  if (route === 'promotions') return fetchPromotions(request);
  if (route === 'sitemap') return fetchSitemap(request);
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
    const products = catalog.products.map(publicProduct);
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const product = products.find((item) => item.id === id);
      if (!product) return json({ message: '제품을 찾을 수 없습니다.' }, 404);
      return json({ product, revision: catalog.revision });
    }
    return json({ products, revision: catalog.revision, updatedAt: catalog.updatedAt });
  } catch {
    return json({ message: '제품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
  }
}
