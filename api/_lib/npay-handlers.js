import { isSameOrigin, json, methodNotAllowed, readJson } from './http.js';
import {
  SITE_ORIGIN,
  buildOrderXml,
  buildProductInformationXml,
  currentProducts,
  naverOrderResult,
  naverWishlistResult,
  npayConfiguration,
  npayProductId,
  npayPublicIsOpen,
  npayPublicConfiguration,
  npayReviewRequestIsValid,
  npayReviewTokenIsValid,
  parseRequestedProductIds,
  productPageUrl,
  readNaverInflowCode,
} from './npay.js';

function validateItems(input, products) {
  const requested = Array.isArray(input?.items) ? input.items : [];
  if (!requested.length || requested.length > 50) {
    throw Object.assign(new Error('주문할 상품을 확인해 주세요.'), { status: 400 });
  }
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  return requested.map((item) => {
    const productId = String(item?.productId || '').trim();
    const optionId = String(item?.optionId || '').trim();
    const quantity = Number(item?.quantity);
    const key = `${productId}::${optionId}`;
    if (!productId || seen.has(key) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw Object.assign(new Error('상품 수량을 1~999개 사이로 확인해 주세요.'), { status: 400 });
    }
    const product = byId.get(productId);
    if (!product) throw Object.assign(new Error('판매 중인 상품을 찾을 수 없습니다.'), { status: 400 });
    const options = Array.isArray(product.options) ? product.options : [];
    const option = options.find((entry) => entry.id === optionId) || null;
    const available = option ? option.stock : product.stock;
    if ((options.length && !option) || available === 0 || (available !== null && quantity > available)) {
      throw Object.assign(new Error(options.length && !option ? '주문할 옵션을 선택해 주세요.' : '선택한 상품의 재고가 부족합니다.'), { status: 409 });
    }
    seen.add(key);
    return { product, option, quantity };
  });
}

function backUrlFor(input, items, request, review) {
  if(review){const origin=new URL(request.url).origin;return input?.context==='product'&&items.length===1?`${origin}/npay-review-product.html?id=${encodeURIComponent(items[0].product.id)}`:`${origin}/npay-review-products.html`;}
  if (input?.context === 'product' && items.length === 1) {
    return `${SITE_ORIGIN}/product.html?id=${encodeURIComponent(items[0].product.id)}`;
  }
  return `${SITE_ORIGIN}/products.html`;
}

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

export async function fetchNpayConfig(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const review = npayReviewRequestIsValid(request)
    || npayReviewTokenIsValid(new URL(request.url).searchParams.get('reviewToken'));
  return json(npayPublicConfiguration({ review }));
}

export async function fetchNpayOrder(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '현재 쇼핑몰에서 시작한 요청만 허용됩니다.' }, 403);

  try {
    const input = await readJson(request, 32_768);
    const reviewToken = String(input?.reviewToken || '').trim();
    const review = npayReviewRequestIsValid(request) || npayReviewTokenIsValid(reviewToken);
    if (!review && !npayPublicIsOpen()) return json({ message: '네이버페이 정식 오픈 전 검수 중입니다.' }, 403);
    const config = npayConfiguration({ mode: review ? 'test' : undefined });
    if (!config.enabled) return json({ message: '네이버페이 설정을 확인하고 있습니다.' }, 503);
    const items = validateItems(input, await currentProducts());
    const body = buildOrderXml({
      config,
      items,
      backUrl: backUrlFor(input, items, request, review),
      naverInflowCode: readNaverInflowCode(request),
    });
    const response = await globalThis.fetch(config.orderRegistrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
      const responseText = await response.text();
      const result = naverOrderResult(responseText);
      if (!response.ok || !result.ok) {
        console.error('npay_order_registration_failed', {
          status: response.status, code: result.code,
          contentType: response.headers.get('content-type'),
          format: /^\s*</.test(responseText) ? 'markup' : /^\s*[{[]/.test(responseText) ? 'json' : 'text',
          length: responseText.length,
          title: responseText.match(/<title[^>]*>([^<]{0,120})<\/title>/i)?.[1] || '',
          prefix: responseText.startsWith('SUCCESS:') ? 'SUCCESS' : responseText.startsWith('FAIL:') ? 'FAIL' : 'other',
        });
      return json({ message: '네이버페이 주문서를 열지 못했습니다. 잠시 후 다시 시도해 주세요.', code: result.code }, 502);
    }
    return json({ key: result.key, merchantNo: result.merchantNo });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'TimeoutError' ? 504 : 500);
    console.error('npay_order_request_failed', { status, message: error?.message || 'unknown error' });
    return json({ message: status >= 500 ? '네이버페이 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' : error.message }, status);
  }
}

export async function fetchNpayProductInformation(request) {
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

export async function fetchNpayWishlist(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '현재 쇼핑몰에서 시작한 요청만 허용됩니다.' }, 403);

  try {
    const input = await readJson(request, 8_192);
    const reviewToken = String(input?.reviewToken || '').trim();
    const review = npayReviewRequestIsValid(request) || npayReviewTokenIsValid(reviewToken);
    if (!review && !npayPublicIsOpen()) return json({ message: '네이버페이 정식 오픈 전 검수 중입니다.' }, 403);
    const config = npayConfiguration({ mode: review ? 'test' : undefined });
    if (!config.enabled) return json({ message: '네이버페이 설정을 확인하고 있습니다.' }, 503);
    const product = (await currentProducts()).find((item) => item.id === String(input?.productId || '').trim());
    if (!product || !product.image || !Number.isInteger(product.price) || product.price < 1) {
      return json({ message: '찜할 상품을 확인해 주세요.' }, 400);
    }

    const form = new URLSearchParams({
      SHOP_ID: config.shopId,
      CERTI_KEY: config.certiKey,
      ITEM_ID: npayProductId(product),
      ITEM_NAME: String(product.name || '').slice(0, 100),
      ITEM_DESC: String(product.description || product.tagline || '').slice(0, 300),
      ITEM_UPRICE: String(product.price),
      ITEM_IMAGE: product.image,
      ITEM_URL: productPageUrl(product),
      RESERVE1: '',
      RESERVE2: '',
      RESERVE3: '',
      RESERVE4: '',
      RESERVE5: '',
    });
    const response = await globalThis.fetch(config.wishlistRegistrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    const payProductId = naverWishlistResult(await response.text());
    if (!response.ok || !payProductId) {
      console.error('npay_wishlist_registration_failed', { status: response.status });
      return json({ message: '네이버 찜 목록에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
    }
    return json({ merchantId: config.shopId, payProductId });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'TimeoutError' ? 504 : 500);
    console.error('npay_wishlist_request_failed', { status, message: error?.message || 'unknown error' });
    return json({ message: status >= 500 ? '네이버페이 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' : error.message }, status);
  }
}
