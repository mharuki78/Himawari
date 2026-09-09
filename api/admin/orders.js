import { readOperations } from '../_lib/operations.js';
import { auditedAdminRequest } from '../_lib/admin-audit.js';
import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { databaseIsConfigured } from '../_lib/database.js';
import { listAdminOrders, updateOrderByAdmin } from '../_lib/orders.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import { sendOrderNotification, retryOrderNotifications } from '../_lib/order-notifications.js';

async function handleRequest(request) {
  if (!['GET', 'PATCH', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'PATCH', 'POST']);
  if (!authIsConfigured() || !databaseIsConfigured()) return json({ message: '관리자 주문관리 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('route') === 'ops-summary') return json(await readOperations(request), 200, { Vary: 'Cookie' });
      return json(await listAdminOrders({ page: url.searchParams.get('page'), status: url.searchParams.get('status') }), 200, { Vary: 'Cookie' });
    }
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    if (request.method === 'POST') {
      if (new URL(request.url).searchParams.get('route') !== 'ops-retry-notifications') return methodNotAllowed(['GET', 'PATCH']);
      return json(await retryOrderNotifications());
    }
    const body = await readJson(request, 16_384);
    const order = await updateOrderByAdmin(body);
    await sendOrderNotification(order, 'admin-status');
    return json({ order }, 200, { Vary: 'Cookie' });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({
      message: status < 500 ? error.message : '주문 정보를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      fieldErrors: error.fieldErrors || {},
    }, status, { Vary: 'Cookie' });
  }
}

export async function fetch(request) { return auditedAdminRequest(request, handleRequest); }
