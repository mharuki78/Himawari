import { createHash, timingSafeEqual } from 'node:crypto';

import {
  productStoreIsConfigured,
  publicProduct,
  readProductCatalog,
  seedCatalog,
} from './products.js';
import { applyInventoryReservations } from './inventory.js';

const SITE_ORIGIN = 'https://himawari.co.kr';
const SHIPPING_GROUP_ID = 'HIMAWARI_DELIVERY';
const SHIPPING_FEE = 3_500;
const FREE_SHIPPING_THRESHOLD = 100_000;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9!+\-/=_|]{1,30}$/;
const NPAY_REVIEW_COOKIE = '__Host-himawari_npay_review';

const ENDPOINTS = {
  test: {
    sdkUrl: 'https://test-pay.naver.com/assets/button/latest/npay.button.js',
    orderRegistrationUrl: 'https://test-api.pay.naver.com/o/customer/api/order/v20/register',
    wishlistRegistrationUrl: 'https://test-pay.naver.com/customer/api/wishlist.nhn',
  },
  production: {
    sdkUrl: 'https://npay-order.pstatic.net/assets/button/latest/npay.button.js',
    orderRegistrationUrl: 'https://api.pay.naver.com/o/customer/api/order/v20/register',
    wishlistRegistrationUrl: 'https://pay.naver.com/customer/api/wishlist.nhn',
  },
};

function clean(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

function xml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function npayMode() {
  const configured = clean(process.env.NPAY_ENV).toLowerCase();
  if (configured === 'test' || configured === 'production') return configured;
  return process.env.VERCEL_ENV === 'production' ? 'production' : 'test';
}

function enabledFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase());
}

export function npayPublicIsOpen() {
  return enabledFlag(process.env.NPAY_PUBLIC_ENABLED);
}

export function npayReviewTokenIsValid(value) {
  // Old review cookies must never select Sandbox after the public launch.
  if (npayPublicIsOpen()) return false;
  const expected = clean(process.env.NPAY_REVIEW_TOKEN);
  const received = clean(value);
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function cookieValue(request, name) {
  const cookie = request?.headers?.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=');
    if (cookieName !== name) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return '';
    }
  }
  return '';
}

export function npayReviewRequestIsValid(request) {
  return npayReviewTokenIsValid(cookieValue(request, NPAY_REVIEW_COOKIE));
}

export function npayReviewSessionCookie(value) {
  if (!npayReviewTokenIsValid(value)) return '';
  return `${NPAY_REVIEW_COOKIE}=${encodeURIComponent(clean(value))}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function npayConfiguration({ mode: requestedMode } = {}) {
  const mode = requestedMode === 'test' || requestedMode === 'production' ? requestedMode : npayMode();
  const shopId = clean(process.env.NPAY_SHOP_ID);
  const certiKey = clean(process.env.NPAY_CERTI_KEY);
  const buttonKey = clean(process.env.NPAY_BUTTON_KEY);
  const accountId = clean(process.env.NPAY_ACCOUNT_ID);
  return {
    mode,
    shopId,
    certiKey,
    buttonKey,
    accountId,
    enabled: Boolean(shopId && certiKey && buttonKey),
    ...ENDPOINTS[mode],
  };
}

export function npayPublicConfiguration({ review = false } = {}) {
  review = review && !npayPublicIsOpen();
  const config = npayConfiguration({ mode: review ? 'test' : undefined });
  const visible = review || npayPublicIsOpen();
  return {
    enabled: Boolean(config.enabled && visible),
    mode: config.mode,
    buttonKey: config.enabled && visible ? config.buttonKey : '',
    sdkUrl: config.sdkUrl,
    trackingConfigured: Boolean(config.accountId),
    review,
  };
}

export async function currentProducts() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return applyInventoryReservations(catalog.products.map(publicProduct));
}

export function npayProductId(product) {
  const sourceId = clean(product?.id);
  if (PRODUCT_ID_PATTERN.test(sourceId)) return sourceId;
  const digest = createHash('sha256').update(sourceId, 'utf8').digest('hex').slice(0, 18);
  return `HIMAWARI-${digest}`;
}

export function productPageUrl(product) {
  return `${SITE_ORIGIN}/product.html?id=${encodeURIComponent(product.id)}`;
}

export function npayOptionManageCode(product, option) {
  return `OPT-${createHash('sha256').update(`${product?.id || ''}:${option?.id || ''}`, 'utf8').digest('hex').slice(0, 20)}`;
}

function npayOptionValueId(product, option) {
  return `VAL-${createHash('sha256').update(`${product?.id || ''}:${option?.id || ''}`, 'utf8').digest('hex').slice(0, 20)}`;
}

function ensurePurchasableProduct(product) {
  const name = clean(product?.name).slice(0, 100);
  const price = Number(product?.price);
  const image = httpsUrl(product?.image);
  if (!product || !name || !Number.isInteger(price) || price < 1 || !image) {
    throw Object.assign(new Error('네이버페이로 구매할 수 없는 상품이 포함되어 있습니다.'), { status: 400 });
  }
  return { name, price, image };
}

function shippingPolicyXml() {
  return `<shippingPolicy><groupId>${SHIPPING_GROUP_ID}</groupId><method>DELIVERY</method><feePayType>PREPAYED</feePayType><feeType>CONDITIONAL_FREE</feeType><feePrice>${SHIPPING_FEE}</feePrice><conditionalFree><basePrice>${FREE_SHIPPING_THRESHOLD}</basePrice></conditionalFree></shippingPolicy>`;
}

function selectedOptionXml(product, option) {
  return `<selectedItem><type>SELECT</type><name>${xml(clean(product.optionName || '옵션').slice(0, 20))}</name><value><id>${npayOptionValueId(product, option)}</id><text>${xml(clean(option.label).slice(0, 50))}</text></value></selectedItem>`;
}

function availableOptionsXml(product, options) {
  if (!options.length) return '';
  const name = xml(clean(product.optionName || '옵션').slice(0, 20));
  const values = options.map((option) => `<value><id>${npayOptionValueId(product, option)}</id><text>${xml(clean(option.label).slice(0, 50))}</text><status>${option.stock > 0 ? 'true' : 'false'}</status></value>`).join('');
  const combinations = options.map((option) => `<combination><manageCode>${npayOptionManageCode(product, option)}</manageCode><price>0</price><stockQuantity>${Math.max(0, option.stock)}</stockQuantity><status>${option.stock > 0 ? 'true' : 'false'}</status><options><name>${name}</name><id>${npayOptionValueId(product, option)}</id></options></combination>`).join('');
  return `<option><optionItem><type>SELECT</type><name>${name}</name>${values}</optionItem>${combinations}</option>`;
}

function productXml(product, quantity, includeAvailability = false, selectedOption = null) {
  const { name, price, image } = ensurePurchasableProduct(product);
  const id = npayProductId(product);
  const options = Array.isArray(product.options) ? product.options : [];
  const stock = product.stock === null ? 99_999 : Math.max(0, Number(product.stock) || 0);
  const availability = includeAvailability
    ? `<status>${stock > 0 ? 'ON_SALE' : 'SOLD_OUT'}</status><stockQuantity>${stock}</stockQuantity><supplementSupport>false</supplementSupport><optionSupport>${options.length ? 'true' : 'false'}</optionSupport>${availableOptionsXml(product, options)}`
    : selectedOption
      ? `<option><quantity>${quantity}</quantity><price>0</price><manageCode>${npayOptionManageCode(product, selectedOption)}</manageCode>${selectedOptionXml(product, selectedOption)}</option>`
      : `<single><quantity>${quantity}</quantity></single>`;
  return `<product><id>${xml(id)}</id><merchantProductId>${xml(id)}</merchantProductId><name>${xml(name)}</name><basePrice>${price}</basePrice><taxType>TAX</taxType><infoUrl>${xml(productPageUrl(product))}</infoUrl><imageUrl>${xml(image)}</imageUrl>${availability}${shippingPolicyXml()}</product>`;
}

export function buildOrderXml({ config, items, backUrl, naverInflowCode = '', saClickId = '' }) {
  const products = items.map(({ product, quantity, option }) => productXml(product, quantity, false, option)).join('');
  const interfaceXml = `<interface><naverInflowCode>${xml(clean(naverInflowCode).slice(0, 300))}</naverInflowCode><saClickId>${xml(clean(saClickId).slice(0, 300))}</saClickId></interface>`;
  return `<?xml version="1.0" encoding="utf-8"?><order><merchantId>${xml(config.shopId)}</merchantId><certiKey>${xml(config.certiKey)}</certiKey><backUrl>${xml(backUrl)}</backUrl>${interfaceXml}${products}</order>`;
}

export function buildProductInformationXml(products) {
  return `<?xml version="1.0" encoding="utf-8"?><products>${products.map((product) => productXml(product, 1, true)).join('')}</products>`;
}

export function parseRequestedProductIds(url) {
  const ids = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (!/^product\[\d+\]\[(?:id|ecmallproductId)\]$/.test(key)) continue;
    const id = clean(value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 50);
}

export function readNaverInflowCode(request) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== 'NA_CO') continue;
    try {
      return decodeURIComponent(rest.join('=')).slice(0, 300);
    } catch {
      return rest.join('=').slice(0, 300);
    }
  }
  return '';
}

export function readNaverSaClickId(request) {
  return cookieValue(request, 'NVADID').slice(0, 300);
}

export function naverOrderResult(value) {
  const text = clean(value);
  // Npay keys are opaque URL tokens and may contain base64url '-' and '_'.
  const success = text.match(/^SUCCESS:([A-Za-z0-9_-]{1,128}):([A-Za-z0-9]{1,64})$/);
  if (success) return { ok: true, key: success[1], merchantNo: success[2] };
  const failure = text.match(/^FAIL:\[?([^\]\s:]+)\]?/);
  return { ok: false, code: failure?.[1] || 'NPAY_ORDER_FAILED' };
}

export function naverWishlistResult(value) {
  const itemId = clean(value);
  return /^[A-Za-z0-9]{1,19}$/.test(itemId) ? itemId : '';
}

export {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  SHIPPING_GROUP_ID,
  SITE_ORIGIN,
};
