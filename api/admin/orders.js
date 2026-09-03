import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { databaseIsConfigured } from '../_lib/database.js';
import { listAdminOrders, updateOrderByAdmin } from '../_lib/orders.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';

export async function fetch(request) {
  if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(['GET', 'PATCH']);
  if (!authIsConfigured() || !databaseIsConfigured()) return json({ message: '관리자 주문관리 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      return json(await listAdminOrders({ page: url.searchParams.get('page'), status: url.searchParams.get('status') }), 200, { Vary: 'Cookie' });
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const body = await readJson(request, 16_384);
    return json({ order: await updateOrderByAdmin(body) }, 200, { Vary: 'Cookie' });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({
      message: status < 500 ? error.message : '주문 정보를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      fieldErrors: error.fieldErrors || {},
    }, status, { Vary: 'Cookie' });
  }
}

