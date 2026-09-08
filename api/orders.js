import { getMember, requireMember } from './_lib/member-auth.js';
import { createOrder, listMemberOrders, readOrderForGuest, requestGuestOrderChange, requestOrderChange } from './_lib/orders.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from './_lib/http.js';
import {
  fetchNpayConfig,
  fetchNpayOrder,
  fetchNpayProductInformation,
  fetchNpayWishlist,
} from './_lib/npay-handlers.js';
import { sendOrderNotification } from './_lib/order-notifications.js';
import { claimCoupon } from './_lib/coupon-claims.js';

const NPAY_ROUTES = {
  'npay-config': fetchNpayConfig,
  'npay-order': fetchNpayOrder,
  'npay-product-info': fetchNpayProductInformation,
  'npay-wishlist': fetchNpayWishlist,
};

export async function fetch(request) {
  const route = new URL(request.url).searchParams.get('route');
  if (NPAY_ROUTES[route]) return NPAY_ROUTES[route](request);
  if (route === 'coupon-claim') {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    try {
      if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
      const claimed = await claimCoupon(request, await readJson(request, 8_192));
      return json({ coupon: claimed.coupon, token: claimed.token, expiresAt: claimed.expiresAt }, 201, claimed.cookie ? { 'Set-Cookie': claimed.cookie } : {});
    } catch (error) { return json({ message: Number(error.status) < 500 ? error.message : '쿠폰을 발급하지 못했습니다.' }, Number(error.status) || 500); }
  }
  if (route === 'guest-order') {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    try {
      if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
      return json({ order: await readOrderForGuest(await readJson(request, 8_192)) });
    } catch (error) { return json({ message: Number(error.status) < 500 ? error.message : '주문을 조회하지 못했습니다.' }, Number(error.status) || 500); }
  }
  if (route === 'guest-order-change') {
    if (request.method !== 'PATCH') return methodNotAllowed(['PATCH']);
    try {
      if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
      const order = await requestGuestOrderChange(await readJson(request, 12_000));
      await sendOrderNotification(order, 'guest-change');
      return json({ order });
    } catch (error) { return json({ message: Number(error.status) < 500 ? error.message : '주문 변경 요청을 처리하지 못했습니다.' }, Number(error.status) || 500); }
  }
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PATCH']);
  try {
    if (request.method === 'GET') {
      const member = await requireMember(request);
      const page = Number(new URL(request.url).searchParams.get('page') || 1);
      return json(await listMemberOrders(member.id, page), 200, { Vary: 'Cookie' });
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const body = await readJson(request, 65_536);
    if (request.method === 'POST') {
      const member = await getMember(request);
      const result = await createOrder(member, body);
      await sendOrderNotification(result.order, 'created');
      return json(result, result.duplicate ? 200 : 201, { Vary: 'Cookie' });
    }
    const member = await requireMember(request);
    const order = await requestOrderChange(member.id, body);
    await sendOrderNotification(order, 'member-change');
    return json({ order }, 200, { Vary: 'Cookie' });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({
      message: status < 500 ? error.message : '주문을 처리하지 못했습니다. 입력 내용은 유지했으니 잠시 후 다시 시도해 주세요.',
      fieldErrors: error.fieldErrors || {},
    }, status, { Vary: 'Cookie' });
  }
}
