import { createHash } from 'node:crypto';

import {
  productStoreIsConfigured,
  publicProduct,
  readProductCatalog,
  seedCatalog,
} from './products.js';

const SITE_ORIGIN = 'https://allaboutbag.com';
const SHIPPING_GROUP_ID = 'HIMAWARI_DELIVERY';
const SHIPPING_FEE = 3_500;
const FREE_SHIPPING_THRESHOLD = 100_000;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9!+\-/=_|]{1,30}$/;

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

export function npayConfiguration() {
  const mode = npayMode();
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

export function npayPublicConfiguration() {
  const config = npayConfiguration();
  return {
    enabled: config.enabled,
    mode: config.mode,
    buttonKey: config.enabled ? config.buttonKey : '',
    sdkUrl: config.sdkUrl,
    trackingConfigured: Boolean(config.accountId),
  };
}

export async function currentProducts() {
  const catalog = productStoreIsConfigured() ? (await readProductCatalog()).catalog : seedCatalog();
  return catalog.products.map(publicProduct);
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

function productXml(product, quantity, includeAvailability = false) {
  const { name, price, image } = ensurePurchasableProduct(product);
  const id = npayProductId(product);
  const availability = includeAvailability
    ? '<status>ON_SALE</status><supplementSupport>false</supplementSupport><optionSupport>false</optionSupport>'
    : `<single><quantity>${quantity}</quantity></single>`;
  return `<product><id>${xml(id)}</id><merchantProductId>${xml(id)}</merchantProductId><name>${xml(name)}</name><basePrice>${price}</basePrice><taxType>TAX</taxType><infoUrl>${xml(productPageUrl(product))}</infoUrl><imageUrl>${xml(image)}</imageUrl>${availability}${shippingPolicyXml()}</product>`;
}

export function buildOrderXml({ config, items, backUrl, naverInflowCode = '' }) {
  const products = items.map(({ product, quantity }) => productXml(product, quantity)).join('');
  const interfaceXml = clean(naverInflowCode)
    ? `<interface><naverInflowCode>${xml(clean(naverInflowCode).slice(0, 300))}</naverInflowCode></interface>`
    : '';
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

export function naverOrderResult(value) {
  const text = clean(value);
  const success = text.match(/^SUCCESS:([A-Za-z0-9]{1,64}):([A-Za-z0-9]{1,64})$/);
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
