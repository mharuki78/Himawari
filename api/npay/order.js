import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  SITE_ORIGIN,
  buildOrderXml,
  currentProducts,
  naverOrderResult,
  npayConfiguration,
  readNaverInflowCode,
} from '../_lib/npay.js';

function validateItems(input, products) {
  const requested = Array.isArray(input?.items) ? input.items : [];
  if (!requested.length || requested.length > 50) {
    throw Object.assign(new Error('주문할 상품을 확인해 주세요.'), { status: 400 });
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  return requested.map((item) => {
    const productId = String(item?.productId || '').trim();
    const quantity = Number(item?.quantity);
    if (!productId || seen.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw Object.assign(new Error('상품 수량을 1~999개 사이로 확인해 주세요.'), { status: 400 });
    }
    const product = byId.get(productId);
    if (!product) throw Object.assign(new Error('판매 중인 상품을 찾을 수 없습니다.'), { status: 400 });
    seen.add(productId);
    return { product, quantity };
  });
}

function backUrlFor(input, items) {
  if (input?.context === 'product' && items.length === 1) {
    return `${SITE_ORIGIN}/product.html?id=${encodeURIComponent(items[0].product.id)}`;
  }
  return `${SITE_ORIGIN}/products.html`;
}

export async function fetch(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '현재 쇼핑몰에서 시작한 요청만 허용됩니다.' }, 403);

  try {
    const config = npayConfiguration();
    if (!config.enabled) return json({ message: '네이버페이 설정을 확인하고 있습니다.' }, 503);
    const input = await readJson(request, 32_768);
    const items = validateItems(input, await currentProducts());
    const body = buildOrderXml({
      config,
      items,
      backUrl: backUrlFor(input, items),
      naverInflowCode: readNaverInflowCode(request),
    });
    const response = await globalThis.fetch(config.orderRegistrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const result = naverOrderResult(await response.text());
    if (!response.ok || !result.ok) {
      console.error('npay_order_registration_failed', { status: response.status, code: result.code });
      return json({ message: '네이버페이 주문서를 열지 못했습니다. 잠시 후 다시 시도해 주세요.', code: result.code }, 502);
    }
    return json({ key: result.key, merchantNo: result.merchantNo });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'TimeoutError' ? 504 : 500);
    console.error('npay_order_request_failed', { status, message: error?.message || 'unknown error' });
    return json({ message: status >= 500 ? '네이버페이 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' : error.message }, status);
  }
}
