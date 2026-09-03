import { readFile } from 'node:fs/promises';

import { methodNotAllowed } from './_lib/http.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './_lib/products.js';
import { renderCatalogPage, renderProductNotFoundPage, renderProductPage } from './_lib/storefront.js';

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
async function template(name) {
  return readFile(new URL(`../${name}`, import.meta.url), 'utf8');
}

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const requestUrl = new URL(request.url);
  const page = requestUrl.searchParams.get('page');
  const origin = requestUrl.origin;
  try {
    const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
    const products = catalog.products.map(publicProduct);
    if (page === 'catalog') {
      return html(renderCatalogPage(await template('products.html'), products, origin));
    }
    if (page === 'product') {
      const product = products.find((item) => item.id === requestUrl.searchParams.get('id'));
      const source = await template('product.html');
      return product ? html(renderProductPage(source, product, origin)) : html(renderProductNotFoundPage(source), 404);
    }
    return html('페이지를 찾을 수 없습니다.', 404);
  } catch {
    return html('제품 페이지를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
