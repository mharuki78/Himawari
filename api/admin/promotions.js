import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import {
  BlobPreconditionFailedError,
  promotionsStoreIsConfigured,
  readPromotions,
  validatePromotionsInput,
  writePromotions,
} from '../_lib/promotions.js';

export async function fetch(request) {
  if (!['GET', 'PUT'].includes(request.method)) return methodNotAllowed(['GET', 'PUT']);
  if (!authIsConfigured() || !promotionsStoreIsConfigured()) return json({ message: '프로모션 관리 저장소 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });

  try {
    const current = await readPromotions();
    if (request.method === 'GET') return json({ config: current.config, etag: current.etag }, 200, { Vary: 'Cookie' });
    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 24_000);
    if ((input.etag || null) !== (current.etag || null)) return json({ message: '프로모션 설정이 변경되었습니다. 새로고침한 뒤 다시 저장해 주세요.' }, 409, { Vary: 'Cookie' });
    const { value, fieldErrors, valid } = validatePromotionsInput(input.config);
    if (!valid) return json({ message: '입력 내용을 확인해 주세요.', fieldErrors }, 400, { Vary: 'Cookie' });
    const saved = await writePromotions({ ...value, revision: current.config.revision }, current.etag);
    return json({ ok: true, config: saved.config, etag: saved.etag }, 200, { Vary: 'Cookie' });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return json({ message: '다른 관리자 작업으로 설정이 변경되었습니다. 새로고침해 주세요.' }, 409, { Vary: 'Cookie' });
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '프로모션 설정을 처리하지 못했습니다.' }, status, { Vary: 'Cookie' });
  }
}
