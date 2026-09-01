import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import test from 'node:test';

import { createSessionCookie, isAdminRequest, verifyAdminPassword } from '../api/_lib/auth.js';
import { isSameOrigin, readJson } from '../api/_lib/http.js';
import { validateInquiry } from '../api/_lib/inquiries.js';
import adminInquiriesHandler from '../api/admin/inquiries.js';
import sessionHandler from '../api/admin/session.js';
import inquiriesHandler from '../api/inquiries.js';

function configureAuth(password = 'correct horse battery staple') {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  process.env.ADMIN_PASSWORD_HASH = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  process.env.ADMIN_SESSION_SECRET = randomBytes(48).toString('base64url');
  return password;
}

function request(url, method = 'GET', body, extraHeaders = {}) {
  return new Request(url, {
    method,
    headers: {
      Origin: new URL(url).origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('문의 입력을 정규화하고 필수 동의를 확인한다', () => {
  const result = validateInquiry({
    requestId: '1234567890123-9b3571c6-66cb-4f30-85a7-79ca7486054e',
    name: '  홍   길동  ',
    email: 'HELLO@example.com ',
    subject: '  제품   문의 ',
    message: '첫 줄\r\n둘째 줄입니다.',
    consent: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.name, '홍 길동');
  assert.equal(result.value.email, 'hello@example.com');
  assert.equal(result.value.subject, '제품 문의');
  assert.equal(result.value.message, '첫 줄\n둘째 줄입니다.');
});

test('문의 필드 오류를 서버에서 모두 반환한다', () => {
  const result = validateInquiry({ name: '', email: 'wrong', subject: '', message: '짧음', consent: false });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), ['consent', 'email', 'message', 'name', 'subject']);
});

test('관리자 비밀번호는 scrypt 해시로 확인하고 서명 쿠키를 검증한다', () => {
  const password = configureAuth();
  assert.equal(verifyAdminPassword(password), true);
  assert.equal(verifyAdminPassword('wrong password'), false);

  const baseRequest = request('http://example.test/api/admin/session');
  const cookie = createSessionCookie(baseRequest).split(';')[0];
  const authenticated = request('http://example.test/api/admin/inquiries', 'GET', undefined, { Cookie: cookie });
  assert.equal(isAdminRequest(authenticated), true);

  const tampered = request('http://example.test/api/admin/inquiries', 'GET', undefined, { Cookie: `${cookie}x` });
  assert.equal(isAdminRequest(tampered), false);
});

test('동일 출처와 JSON 크기 계약을 확인한다', async () => {
  assert.equal(isSameOrigin(request('https://example.test/api/inquiries', 'POST', {})), true);
  assert.equal(isSameOrigin(request('https://example.test/api/inquiries', 'POST', {}, { Origin: 'https://evil.test' })), false);
  const value = await readJson(request('https://example.test/api/inquiries', 'POST', { ok: true }));
  assert.equal(value.ok, true);
});

test('공개 문의 API는 다른 출처와 미설정 저장소를 거부한다', async () => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;

  const crossOrigin = await inquiriesHandler(request('https://example.test/api/inquiries', 'POST', {}, { Origin: 'https://evil.test' }));
  assert.equal(crossOrigin.status, 403);

  const unconfigured = await inquiriesHandler(request('https://example.test/api/inquiries', 'POST', {}));
  assert.equal(unconfigured.status, 503);
});

test('관리자 로그인은 올바른 비밀번호에만 HttpOnly 세션을 발급한다', async () => {
  const password = configureAuth();
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_fake_token';

  const wrong = await sessionHandler(request('http://example.test/api/admin/session', 'POST', { password: 'wrong' }, { 'X-Forwarded-For': 'wrong-test' }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const correct = await sessionHandler(request('http://example.test/api/admin/session', 'POST', { password }, { 'X-Forwarded-For': 'correct-test' }));
  assert.equal(correct.status, 200);
  assert.match(correct.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(correct.headers.get('set-cookie') || '', /SameSite=Strict/);
});

test('관리자 문의 API는 서명 세션 없이는 Blob을 읽지 않는다', async () => {
  configureAuth();
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_fake_token';
  const response = await adminInquiriesHandler(request('https://example.test/api/admin/inquiries'));
  assert.equal(response.status, 401);
});
