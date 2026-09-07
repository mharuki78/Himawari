import { methodNotAllowed } from '../_lib/http.js';
import {
  buildProductInformationXml,
  currentProducts,
  npayProductId,
  parseRequestedProductIds,
} from '../_lib/npay.js';

function xmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function fetch(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const requestedIds = parseRequestedProductIds(new URL(request.url));
    if (!requestedIds.length) return xmlResponse('<?xml version="1.0" encoding="utf-8"?><products></products>', 400);
    const products = await currentProducts();
    const byNpayId = new Map(products.map((product) => [npayProductId(product), product]));
    const matches = requestedIds.map((id) => byNpayId.get(id)).filter(Boolean);
    return xmlResponse(buildProductInformationXml(matches));
  } catch (error) {
    console.error('npay_product_information_failed', { message: error?.message || 'unknown error' });
    return xmlResponse('<?xml version="1.0" encoding="utf-8"?><products></products>', 500);
  }
}
