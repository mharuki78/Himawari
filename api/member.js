import { clearMemberCookies, deleteMemberAccount, requireMember } from './_lib/member-auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from './_lib/http.js';
import {
  readMemberCart,
  readMemberWishlist,
  replaceMemberCart,
  replaceMemberWishlist,
  validateCartItems,
  validateWishlist,
} from './_lib/member-store.js';

async function cart(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  try {
    const member = await requireMember(request);
    if (request.method === 'GET') return json({ items: await readMemberCart(member.id) });
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const body = await readJson(request, 65_536);
    const { items } = await validateCartItems(body.items);
    return json({ items: await replaceMemberCart(member.id, items) });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '장바구니를 저장하지 못했습니다.' }, status);
  }
}

async function wishlist(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  try {
    const member = await requireMember(request);
    if (request.method === 'GET') return json({ items: await readMemberWishlist(member.id) });
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const body = await readJson(request, 32_768);
    const productIds = await validateWishlist(body.productIds);
    return json({ items: await replaceMemberWishlist(member.id, productIds) });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '관심상품을 저장하지 못했습니다.' }, status);
  }
}

async function account(request) {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
  try {
    const member = await requireMember(request);
    const body = await readJson(request);
    if (body.confirmation !== '회원탈퇴') return json({ message: '탈퇴 확인 문구를 정확히 입력해 주세요.' }, 400);
    await deleteMemberAccount(member.id);
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    clearMemberCookies(request).forEach((cookie) => headers.append('Set-Cookie', cookie));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '회원탈퇴를 완료하지 못했습니다.' }, status);
  }
}

export function fetch(request) {
  const route = new URL(request.url).searchParams.get('route') || '';
  if (route === 'cart') return cart(request);
  if (route === 'wishlist') return wishlist(request);
  if (route === 'account') return account(request);
  return json({ message: '회원 경로를 찾을 수 없습니다.' }, 404);
}

