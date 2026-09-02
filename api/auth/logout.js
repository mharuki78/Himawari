import { clearMemberCookies, revokeMemberSession } from '../_lib/member-auth.js';
import { isSameOrigin, json, methodNotAllowed } from '../_lib/http.js';

export async function fetch(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
  try {
    await revokeMemberSession(request);
  } catch {
    // 쿠키는 데이터베이스 상태와 무관하게 지워 로그아웃을 완료합니다.
  }
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
  clearMemberCookies(request).forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
