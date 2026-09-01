import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  deleteManagedImages,
  productStoreIsConfigured,
  verifyManagedImageOwnership,
} from '../_lib/products.js';

export async function fetch(request) {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  if (!authIsConfigured() || !productStoreIsConfigured()) return json({ message: '제품 이미지 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401);
  if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);

  try {
    const input = await readJson(request, 16_384);
    const urls = await verifyManagedImageOwnership(input.requestId, Array.isArray(input.urls) ? input.urls : []);
    const removed = await deleteManagedImages(urls);
    if (!removed) return json({ message: '임시 이미지를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503);
    return json({ ok: true });
  } catch (error) {
    return json({ message: error.message || '임시 이미지를 정리하지 못했습니다.' }, Number(error.status) || 400);
  }
}
