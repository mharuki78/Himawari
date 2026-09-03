import { authIsConfigured, clearSessionCookies, createSessionCookie, isAdminRequest, verifyAdminPassword } from '../_lib/auth.js';
import { clientIp, isSameOrigin, json, methodNotAllowed, readJson } from '../_lib/http.js';

const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function failureState(ip) {
  const now = Date.now();
  const current = failures.get(ip);
  if (!current || current.resetAt <= now) return { count: 0, resetAt: now + WINDOW_MS };
  return current;
}

function setCookieResponse(data, status, cookies) {
  const headers = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  });
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(JSON.stringify(data), { status, headers });
}

export async function fetch(request) {
  if (!['POST', 'DELETE'].includes(request.method)) return methodNotAllowed(['POST', 'DELETE']);
  if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
  if (!authIsConfigured()) return json({ message: '관리자 인증 설정이 완료되지 않았습니다.' }, 503);

  if (request.method === 'DELETE') {
    return setCookieResponse({ ok: true }, 200, clearSessionCookies(request));
  }

  if (isAdminRequest(request)) return json({ ok: true }, 200, { Vary: 'Cookie' });

  const ip = clientIp(request);
  const state = failureState(ip);
  if (state.count >= MAX_FAILURES) {
    return json({ message: '로그인 시도가 많았습니다. 15분 뒤 다시 시도해 주세요.' }, 429);
  }

  try {
    const input = await readJson(request, 2_048);
    const password = typeof input.password === 'string' ? input.password : '';
    if (!password || password.length > 256 || !verifyAdminPassword(password)) {
      failures.set(ip, { count: state.count + 1, resetAt: state.resetAt });
      await new Promise((resolve) => setTimeout(resolve, 450));
      return json({ message: '관리자 비밀번호를 확인해 주세요.' }, 401, { Vary: 'Cookie' });
    }

    failures.delete(ip);
    return setCookieResponse({ ok: true, expiresIn: 8 * 60 * 60 }, 200, [createSessionCookie(request)]);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '로그인 처리 중 문제가 발생했습니다.' }, status);
  }
}
