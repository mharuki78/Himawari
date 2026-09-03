import { requireMember } from './_lib/member-auth.js';
import { createOrder, listMemberOrders, requestOrderChange } from './_lib/orders.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from './_lib/http.js';

export async function fetch(request) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'POST', 'PATCH']);
  try {
    const member = await requireMember(request);
    if (request.method === 'GET') {
      const page = Number(new URL(request.url).searchParams.get('page') || 1);
      return json(await listMemberOrders(member.id, page), 200, { Vary: 'Cookie' });
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const body = await readJson(request, 65_536);
    if (request.method === 'POST') {
      const result = await createOrder(member, body);
      return json(result, result.duplicate ? 200 : 201, { Vary: 'Cookie' });
    }
    return json({ order: await requestOrderChange(member.id, body) }, 200, { Vary: 'Cookie' });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({
      message: status < 500 ? error.message : '주문을 처리하지 못했습니다. 입력 내용은 유지했으니 잠시 후 다시 시도해 주세요.',
      fieldErrors: error.fieldErrors || {},
    }, status, { Vary: 'Cookie' });
  }
}

