import { isSameOrigin, json, methodNotAllowed, readJson } from './_lib/http.js';
import { createVerifiedReview, listPublishedReviews, subscribeRestock, unsubscribeRestock } from './_lib/customer-features.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './_lib/products.js';
import { publicPromotions, readPromotions } from './_lib/promotions.js';
import { applyInventoryReservations } from './_lib/inventory.js';
import storyPosts from '../story/posts.json' with { type: 'json' };

const SITE_ORIGIN = 'https://allaboutbag.com';
const SITEMAP_PAGES = [
  ['/', '2026-09-07'],
  ['/about.html', '2026-08-29'],
  ['/products.html', '2026-09-03'],
  ['/finder.html', '2026-09-07'],
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

function xml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

async function fetchMerchantFeed(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  const available = await applyInventoryReservations(catalog.products.map(publicProduct));
  const items = available.filter((product) => product.image && product.price > 0).map((product) => `
    <item><g:id>${xml(product.id)}</g:id><title>${xml(product.name)}</title><description>${xml(product.description || product.tagline)}</description><link>${SITE_ORIGIN}/product.html?id=${encodeURIComponent(product.id)}</link><g:image_link>${xml(product.image)}</g:image_link><g:availability>${product.soldOut ? 'out_of_stock' : 'in_stock'}</g:availability><g:price>${Number(product.price)} KRW</g:price><g:condition>new</g:condition><g:brand>Himawari</g:brand><g:mpn>${xml(product.model)}</g:mpn><g:shipping><g:country>KR</g:country><g:service>로젠택배</g:service><g:price>${product.price >= 100000 ? 0 : 3500} KRW</g:price></g:shipping></item>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Himawari 제품</title><link>${SITE_ORIGIN}</link><description>Himawari 백팩 공식 상품 피드</description>${items}\n</channel></rss>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600', 'X-Content-Type-Options': 'nosniff' } });
}

async function fetchReviews(request) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
  try {
    if (request.method === 'GET') return json(await listPublishedReviews(new URL(request.url).searchParams.get('productId')));
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    return json(await createVerifiedReview(await request.formData()), 201);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '리뷰를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, status);
  }
}

async function fetchRestock(request) {
  if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
  try {
    if (request.method === 'GET') return json(await unsubscribeRestock(new URL(request.url).searchParams.get('token') || ''));
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    return json(await subscribeRestock(await readJson(request, 8_192)), 201);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '재입고 알림을 처리하지 못했습니다.' }, status);
  }
}

export async function fetch(request) {
  const route = new URL(request.url).searchParams.get('route');
  if (route === 'promotions') return fetchPromotions(request);
  if (route === 'sitemap') return fetchSitemap(request);
  if (route === 'merchant-feed') return fetchMerchantFeed(request);
  if (route === 'reviews') return fetchReviews(request);
  if (route === 'restock') return fetchRestock(request);
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
    const products = await applyInventoryReservations(catalog.products.map(publicProduct));
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
