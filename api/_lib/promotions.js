import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob';

const PROMOTIONS_PATH = 'promotions/v1/settings.json';
const COUPON_DEFINITIONS = Object.freeze([
  { id: 'shipping-free', label: '무료배송 쿠폰', type: 'free_shipping', rate: 0 },
  { id: 'discount-10', label: '10% 할인 쿠폰', type: 'percent', rate: 10 },
  { id: 'discount-15', label: '15% 할인 쿠폰', type: 'percent', rate: 15 },
  { id: 'discount-20', label: '20% 할인 쿠폰', type: 'percent', rate: 20 },
]);

function token() {
  return process.env.PRODUCT_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '';
}

function singleLine(value, maximum = 200) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function multiLine(value, maximum = 1_000) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

function safePath(value) {
  const path = singleLine(value, 500);
  if (!path) return '';
  try {
    const url = new URL(path, 'https://allaboutbag.com');
    if (url.origin !== 'https://allaboutbag.com') return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function optionalIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function normalizeEtag(value) {
  return String(value || '').trim().replace(/^W\//i, '');
}

export function promotionsStoreIsConfigured() {
  return Boolean(token());
}

export function defaultPromotions() {
  return {
    version: 1,
    revision: 1,
    updatedAt: '2026-09-06T00:00:00.000Z',
    popup: {
      enabled: true,
      title: 'Himawari 자사몰 혜택',
      message: '새로운 자사몰 주문서에서 현재 적용 가능한 쿠폰을 확인해 보세요. 회원가입 없이도 주문할 수 있습니다.',
      linkLabel: '제품 보러가기',
      linkUrl: '/products.html',
    },
    coupons: COUPON_DEFINITIONS.map((coupon) => ({
      ...coupon,
      active: false,
      minimumSubtotal: 0,
      maximumDiscount: 0,
      expiresAt: '',
    })),
  };
}

export function normalizePromotions(input = {}) {
  const defaults = defaultPromotions();
  const supplied = new Map((Array.isArray(input.coupons) ? input.coupons : []).map((coupon) => [singleLine(coupon?.id, 40), coupon]));
  return {
    version: 1,
    revision: Math.max(1, integer(input.revision, 1)),
    updatedAt: optionalIso(input.updatedAt),
    popup: {
      enabled: input.popup?.enabled === true,
      title: singleLine(input.popup?.title, 80) || defaults.popup.title,
      message: multiLine(input.popup?.message, 500) || defaults.popup.message,
      linkLabel: singleLine(input.popup?.linkLabel, 40) || defaults.popup.linkLabel,
      linkUrl: safePath(input.popup?.linkUrl) || defaults.popup.linkUrl,
    },
    coupons: COUPON_DEFINITIONS.map((definition) => {
      const value = supplied.get(definition.id) || {};
      return {
        ...definition,
        active: value.active === true,
        minimumSubtotal: Math.max(0, integer(value.minimumSubtotal, 0)),
        maximumDiscount: definition.type === 'percent' ? Math.max(0, integer(value.maximumDiscount, 0)) : 0,
        expiresAt: optionalIso(value.expiresAt),
      };
    }),
  };
}

export function validatePromotionsInput(input) {
  const value = normalizePromotions(input);
  const fieldErrors = {};
  if (!input?.popup || singleLine(input.popup.title, 80).length < 2) fieldErrors.popupTitle = '팝업 제목을 2자 이상 입력해 주세요.';
  if (!input?.popup || multiLine(input.popup.message, 500).length < 5) fieldErrors.popupMessage = '팝업 내용을 5자 이상 입력해 주세요.';
  if (input?.popup?.linkUrl && !safePath(input.popup.linkUrl)) fieldErrors.popupLinkUrl = '사이트 내부 주소만 입력해 주세요.';

  for (const coupon of value.coupons) {
    if (coupon.minimumSubtotal > 30_000_000) fieldErrors[`${coupon.id}Minimum`] = '최소 주문금액은 3천만원 이하로 입력해 주세요.';
    if (coupon.maximumDiscount > 30_000_000) fieldErrors[`${coupon.id}Maximum`] = '최대 할인금액은 3천만원 이하로 입력해 주세요.';
    const suppliedCoupon = (Array.isArray(input?.coupons) ? input.coupons : []).find((item) => item?.id === coupon.id);
    if (suppliedCoupon?.expiresAt && !optionalIso(suppliedCoupon.expiresAt)) fieldErrors[`${coupon.id}ExpiresAt`] = '종료 일시를 확인해 주세요.';
  }
  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function activeCoupons(config, now = new Date()) {
  const instant = now.getTime();
  return normalizePromotions(config).coupons.filter((coupon) => (
    coupon.active && (!coupon.expiresAt || new Date(coupon.expiresAt).getTime() > instant)
  ));
}

export function publicPromotions(config, now = new Date()) {
  const normalized = normalizePromotions(config);
  return {
    updatedAt: normalized.updatedAt,
    popup: normalized.popup,
    coupons: activeCoupons(normalized, now),
  };
}

export async function readPromotions() {
  if (!promotionsStoreIsConfigured()) return { config: defaultPromotions(), etag: null, persisted: false };
  try {
    const metadata = await head(PROMOTIONS_PATH, { token: token() });
    const result = await get(metadata.url, { access: 'public', token: token(), useCache: false });
    if (!result || result.statusCode !== 200) return { config: defaultPromotions(), etag: null, persisted: false };
    const parsed = JSON.parse(await new Response(result.stream).text());
    return { config: normalizePromotions(parsed), etag: normalizeEtag(metadata.etag), persisted: true };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { config: defaultPromotions(), etag: null, persisted: false };
    throw error;
  }
}

export async function writePromotions(config, etag) {
  const normalized = normalizePromotions(config);
  const next = { ...normalized, revision: normalized.revision + 1, updatedAt: new Date().toISOString() };
  const result = await put(PROMOTIONS_PATH, JSON.stringify(next), {
    access: 'public',
    token: token(),
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    ...(etag ? { allowOverwrite: true, ifMatch: normalizeEtag(etag) } : { allowOverwrite: false }),
  });
  return { config: next, etag: result.etag };
}

export { BlobPreconditionFailedError, COUPON_DEFINITIONS, PROMOTIONS_PATH };
