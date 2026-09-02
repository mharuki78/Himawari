import { clearMemberCookies, deleteMemberAccount, requireMember } from '../_lib/member-auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';

export async function fetch(request) {
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
