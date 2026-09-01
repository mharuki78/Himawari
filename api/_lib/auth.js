import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PROD_COOKIE = '__Host-himawari_admin';
const DEV_COOKIE = 'himawari_admin';

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left);
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authIsConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET?.length >= 32);
}

export function verifyAdminPassword(password) {
  const [scheme, saltValue, hashValue, ...rest] = (process.env.ADMIN_PASSWORD_HASH || '').split('$');
  if (scheme !== 'scrypt' || !saltValue || !hashValue || rest.length || typeof password !== 'string') return false;

  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = scryptSync(password, Buffer.from(saltValue, 'base64url'), expected.length);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

function cookieName(request) {
  return new URL(request.url).protocol === 'https:' ? PROD_COOKIE : DEV_COOKIE;
}

function signature(payload) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(payload).digest('base64url');
}

export function createSessionCookie(request) {
  const payload = encode(JSON.stringify({ version: 1, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }));
  const value = `${payload}.${signature(payload)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearSessionCookies(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return [
    `${PROD_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`,
    `${DEV_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  ];
}

function cookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, value.join('=')]),
  );
}

export function isAdminRequest(request) {
  if (!authIsConfigured()) return false;
  const value = cookies(request)[cookieName(request)];
  if (!value) return false;
  const [payload, providedSignature, ...rest] = value.split('.');
  if (!payload || !providedSignature || rest.length || !safeEqual(providedSignature, signature(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.version === 1 && Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}
