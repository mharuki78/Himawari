import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  currentProducts,
  naverWishlistResult,
  npayConfiguration,
  npayProductId,
  productPageUrl,
} from '../_lib/npay.js';

export async function fetch(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '현재 쇼핑몰에서 시작한 요청만 허용됩니다.' }, 403);

  try {
    const config = npayConfiguration();
    if (!config.enabled) return json({ message: '네이버페이 설정을 확인하고 있습니다.' }, 503);
    const input = await readJson(request, 8_192);
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
