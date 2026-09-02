import assert from 'node:assert/strict';
import test from 'node:test';

import { startOAuth } from '../api/_lib/oauth.js';
import {
  createOAuthStateCookie,
  providerStatus,
  readOAuthState,
  safeReturnTo,
} from '../api/_lib/member-auth.js';
import { fetch as memberHandler } from '../api/member.js';

const originalEnvironment = {
  MEMBER_SESSION_SECRET: process.env.MEMBER_SESSION_SECRET,
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};

test.after(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('로그인 복귀 주소는 같은 사이트의 경로만 허용한다', () => {
  assert.equal(safeReturnTo('/products.html?id=store-1'), '/products.html?id=store-1');
  assert.equal(safeReturnTo('https://attacker.example/steal'), '/');
  assert.equal(safeReturnTo('//attacker.example/steal'), '/');
  assert.equal(safeReturnTo('/ok\r\nInjected: yes'), '/');
});

test('OAuth 상태 쿠키는 서명·제공자·만료·state를 검증한다', () => {
  process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const start = new Request('https://allaboutbag.com/api/auth/start');
  const created = createOAuthStateCookie(start, { provider: 'naver', returnTo: '/products.html' });
  assert.match(created.cookie, /HttpOnly/);
  assert.match(created.cookie, /Secure/);
  assert.match(created.cookie, /SameSite=Lax/);
  const cookie = created.cookie.split(';')[0];
  const callback = new Request(`https://allaboutbag.com/api/auth/callback/naver?state=${created.state}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(readOAuthState(callback, 'naver', created.state).returnTo, '/products.html');
  assert.equal(readOAuthState(callback, 'google', created.state), null);
  assert.equal(readOAuthState(callback, 'naver', `${created.state}tampered`), null);
});

test('설정된 네이버 로그인은 공식 인증 주소와 PKCE와 분리된 state 쿠키를 사용한다', () => {
  process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  process.env.NAVER_CLIENT_ID = 'naver-client';
  process.env.NAVER_CLIENT_SECRET = 'naver-secret';
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.deepEqual(providerStatus(), { naver: true, google: false });
  const response = startOAuth(new Request('https://allaboutbag.com/api/auth/start?provider=naver&returnTo=%2Fproducts.html'));
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://nid.naver.com');
  assert.equal(location.searchParams.get('client_id'), 'naver-client');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://allaboutbag.com/api/auth/callback/naver');
  assert.ok(location.searchParams.get('state'));
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
});

test('회원 장바구니와 관심상품 API는 로그인 없는 요청을 거부한다', async () => {
  delete process.env.DATABASE_URL;
  process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const cart = await memberHandler(new Request('https://allaboutbag.com/api/member?route=cart'));
  const wishlist = await memberHandler(new Request('https://allaboutbag.com/api/member?route=wishlist'));
  assert.equal(cart.status, 401);
  assert.equal(wishlist.status, 401);
});
