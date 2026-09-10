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
  school: { title: '학생·책가방', description: '등굣길의 움직임과 수납을 고려한 Himawari 학생 백팩.', line1: '가볍고 단정한', line2: '학생·책가방.' },
  business: { title: '출근·노트북', description: '노트북 수납과 도시 이동을 고려한 Himawari 비즈니스 백팩.', line1: '도시의 업무를 위한', line2: '출근·노트북 백팩.' },
  travel: { title: '여행·육아', description: '여행과 가족의 하루에 필요한 수납을 담은 Himawari 백팩.', line1: '긴 하루를 정돈하는', line2: '여행·육아 백팩.' },
  daily: { title: '데일리·미니', description: '가벼운 일상에 어울리는 균형 잡힌 Himawari 데일리 백팩.', line1: '매일 편안하게 드는', line2: '데일리 백팩.' },
};

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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
  try {
    if (page === 'npay-review') {
      const token = requestUrl.searchParams.get('token') || '';
      if (!npayReviewTokenIsValid(token)) return privateHtml('검수 페이지를 찾을 수 없습니다.', 404);
      return reviewRedirect(origin + '/npay-review-products.html', npayReviewSessionCookie(token));
    }
    if (['npay-review-catalog', 'npay-review-product'].includes(page) && !npayReviewRequestIsValid(request)) {
      return privateHtml('검수 페이지를 찾을 수 없습니다.', 404);
    }
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
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
      const source = await template('templates/product.html');
      if (!product) return (page === 'npay-review-product' ? privateHtml : html)(renderProductNotFoundPage(source), 404);
      let reviewData = null;
      try { reviewData = await listPublishedReviews(product.id, 0, true); } catch {}
      const familyProducts = products.filter((item) => productFamilyKey(item) === productFamilyKey(product));
      const body = renderProductPage(source, product, origin, reviewData, familyProducts);
      if(page==='npay-review-product')return privateHtml(reviewProductPage(body));
      return npayReviewRequestIsValid(request) ? privateHtml(body) : html(body);
    }
    return html('페이지를 찾을 수 없습니다.', 404);
  } catch {
    return (String(page).startsWith('npay-review')?privateHtml:html)('제품 페이지를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
