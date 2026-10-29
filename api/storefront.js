import { renderNpayReviewCatalog, reviewProductPage } from './_lib/npay-review-page.js';
import { readFile } from 'node:fs/promises';

import { methodNotAllowed } from './_lib/http.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from './_lib/storefront.js';
import { npayReviewRequestIsValid, npayReviewSessionCookie, npayReviewTokenIsValid } from './_lib/npay.js';
import { listPublishedReviews } from './_lib/customer-features.js';
import { applyInventoryReservations } from './_lib/inventory.js';
import { productCategory, productFamilyKey } from '../assets/catalog-tools.js';

const COLLECTIONS = {
  school: { title: '학생·책가방', description: 'Himawari 학생 백팩의 크기와 수납 정보를 살펴보세요.', line1: '등교할 때 필요한', line2: '가방을 찾아보세요.' },
  business: { title: '출근·노트북', description: '출근용 가방을 찾고 있다면 Himawari 백팩의 노트북 수납칸과 크기를 비교해 보세요.', line1: '노트북을 넣고', line2: '출근할 가방을 찾아보세요.' },
  travel: { title: '여행·육아', description: '여행 짐과 육아 용품을 넣을 가방을 찾는다면 Himawari 백팩의 크기와 수납 정보를 확인해 보세요.', line1: '여행 짐과 육아 용품을', line2: '담을 가방을 찾아보세요.' },
  daily: { title: '데일리·미니', description: '가까운 외출에 들 가방부터 평소에 멜 백팩까지, Himawari 데일리 제품을 살펴보세요.', line1: '가까운 외출에 들', line2: '데일리 가방을 만나보세요.' },
};

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': status >= 500 ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
function privateHtml(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
function reviewRedirect(location, cookie) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Set-Cookie': cookie,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
async function template(name) {
  return readFile(new URL(`../${name}`, import.meta.url), 'utf8');
}

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const requestUrl = new URL(request.url);
  const page = requestUrl.searchParams.get('page');
  const origin = requestUrl.origin;
  let phase = 'request';
  try {
    if (page === 'npay-review') {
      const token = requestUrl.searchParams.get('token') || '';
      if (!npayReviewTokenIsValid(token)) return privateHtml('검수 페이지를 찾을 수 없습니다.', 404);
      return reviewRedirect(origin + '/npay-review-products.html', npayReviewSessionCookie(token));
    }
    if (['npay-review-catalog', 'npay-review-product'].includes(page) && !npayReviewRequestIsValid(request)) {
      return privateHtml('검수 페이지를 찾을 수 없습니다.', 404);
    }
    phase = 'catalog';
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
    phase = 'inventory';
    const products = await applyInventoryReservations(catalog.products.map(publicProduct));
    if (page === 'npay-review-catalog') return privateHtml(renderNpayReviewCatalog(products));
    if (page === 'catalog') {
      return html(renderCatalogPage(await template('templates/products.html'), products, origin));
    }
    if (page === 'collection') {
      const key = requestUrl.searchParams.get('collection');
      const collection = COLLECTIONS[key];
      if (!collection) return html('컬렉션을 찾을 수 없습니다.', 404);
      const filtered = products.filter((product) => productCategory(product) === key);
      return html(renderCatalogPage(await template('templates/products.html'), filtered, origin, { key, ...collection }));
    }
    if (page === 'product' || page === 'npay-review-product') {
      const product = products.find((item) => item.id === requestUrl.searchParams.get('id'));
      phase = 'product-template';
      const source = await template('templates/product.html');
      if (!product) return (page === 'npay-review-product' ? privateHtml : html)(renderProductNotFoundPage(source), 404);
      let reviewData = null;
      try { reviewData = await listPublishedReviews(product.id, 0, true); } catch {}
      const familyProducts = products.filter((item) => productFamilyKey(item) === productFamilyKey(product));
      phase = 'product-render';
      const body = renderProductPage(source, product, origin, reviewData, familyProducts);
      if(page==='npay-review-product')return privateHtml(reviewProductPage(body));
      return npayReviewRequestIsValid(request) ? privateHtml(body) : html(body);
    }
    return html('페이지를 찾을 수 없습니다.', 404);
  } catch (error) {
    console.error('storefront_render_failed', {
      phase, name: error?.name, code: error?.code,
      upstreamStatus: String(error?.message || '').match(/^Vercel Blob: Failed to fetch blob: (\d{3})\b/)?.[1],
      frames: String(error?.stack || '').split('\n').slice(1, 4),
    });
    return (String(page).startsWith('npay-review')?privateHtml:html)('제품 페이지를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
