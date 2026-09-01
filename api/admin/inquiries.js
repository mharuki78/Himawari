import { BlobNotFoundError } from '@vercel/blob';
import { authIsConfigured, isAdminRequest } from '../_lib/auth.js';
import { blobIsConfigured, isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';
import { BlobPreconditionFailedError, deleteInquiry, listInquiries } from '../_lib/inquiries.js';

export default async function handler(request) {
  if (!['GET', 'DELETE'].includes(request.method)) return methodNotAllowed(['GET', 'DELETE']);
  if (!authIsConfigured() || !blobIsConfigured()) return json({ message: '관리자 문의함 설정이 완료되지 않았습니다.' }, 503);
  if (!isAdminRequest(request)) return json({ message: '관리자 로그인이 필요합니다.' }, 401, { Vary: 'Cookie' });

  try {
    if (request.method === 'GET') {
      const cursor = new URL(request.url).searchParams.get('cursor') || '';
      if (cursor.length > 1_024) return json({ message: '목록 위치 값이 올바르지 않습니다.' }, 400);
      const result = await listInquiries(cursor);
      return json(result, 200, { Vary: 'Cookie' });
    }

    if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
    const input = await readJson(request, 4_096);
    await deleteInquiry(input.pathname, input.etag);
    return json({ ok: true }, 200, { Vary: 'Cookie' });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      return json({ message: '문의가 이미 변경되었거나 삭제되었습니다. 목록을 새로고침해 주세요.' }, 409);
    }
    if (error instanceof BlobNotFoundError) return json({ message: '이미 삭제된 문의입니다.' }, 404);
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '문의함을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, status, { Vary: 'Cookie' });
  }
}
