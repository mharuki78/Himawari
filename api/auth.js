import { clearMemberCookies, getMember, memberAuthIsConfigured, providerStatus, revokeMemberSession } from './_lib/member-auth.js';
import { isSameOrigin, json, methodNotAllowed } from './_lib/http.js';
import { completeOAuth, startOAuth } from './_lib/oauth.js';

async function session(request) {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!memberAuthIsConfigured()) {
    return json({ authenticated: false, configured: false, providers: providerStatus() }, 503);
  }
  try {
    const user = await getMember(request);
    return json({ authenticated: Boolean(user), configured: true, providers: providerStatus(), user });
  } catch {
    return json({ authenticated: false, configured: true, providers: providerStatus(), user: null });
  }
}

async function logout(request) {
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

export function fetch(request) {
  const route = new URL(request.url).searchParams.get('route') || '';
  if (route === 'start') {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return startOAuth(request);
  }
  if (route === 'callback-google') return completeOAuth(request, 'google');
  if (route === 'callback-naver') return completeOAuth(request, 'naver');
  if (route === 'session') return session(request);
  if (route === 'logout') return logout(request);
  return json({ message: '인증 경로를 찾을 수 없습니다.' }, 404);
}

