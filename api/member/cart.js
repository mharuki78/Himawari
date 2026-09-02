import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import { requireMember } from '../_lib/member-auth.js';
import { readMemberCart, replaceMemberCart, validateCartItems } from '../_lib/member-store.js';

export async function fetch(request) {
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

