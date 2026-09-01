import { json, methodNotAllowed } from './_lib/http.js';
import { productStoreIsConfigured, publicProduct, readProductCatalog, seedCatalog } from './_lib/products.js';

export default async function handler(request) {
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

