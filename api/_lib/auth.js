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
  return Boolean(adminForPassword(password));
}

function matchesHash(password, hash) {
  const [scheme, saltValue, hashValue, ...rest] = (hash || '').split('$');
  if (scheme !== 'scrypt' || !saltValue || !hashValue || rest.length || typeof password !== 'string') return false;

  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const salt = Buffer.from(saltValue, 'base64url');
    if (expected.length !== 64 || salt.length < 16) return false;
    const actual = scryptSync(password, salt, expected.length);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function adminForPassword(password) {
  if (matchesHash(password, process.env.ADMIN_PASSWORD_HASH)) return { id: 'owner', role: 'owner' };
  let accounts = [];
  try { accounts = JSON.parse(process.env.ADMIN_STAFF_ACCOUNTS || '[]'); } catch { return null; }
  if (!Array.isArray(accounts)) return null;
  for (const account of accounts.slice(0, 20)) {
    if (/^[a-zA-Z0-9_-]{1,50}$/.test(account.id || '') && ['catalog', 'fulfillment', 'support', 'viewer'].includes(account.role) && matchesHash(password, account.passwordHash)) return { id: account.id, role: account.role };
  }
  return null;
}

function cookieName(request) {
  return new URL(request.url).protocol === 'https:' ? PROD_COOKIE : DEV_COOKIE;
}

function signature(payload) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET || '').update(payload).digest('base64url');
}

export function createSessionCookie(request, principal = { id: 'owner', role: 'owner' }) {
  const payload = encode(JSON.stringify({ version: 2, id: principal.id, role: principal.role, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }));
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

export function readAdminSession(request) {
  if (!authIsConfigured()) return false;
  const value = cookies(request)[cookieName(request)];
  if (!value) return false;
  const [payload, providedSignature, ...rest] = value.split('.');
  if (!payload || !providedSignature || rest.length || !safeEqual(providedSignature, signature(payload))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (![1, 2].includes(session.version) || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    if (session.version === 1) return { id: 'owner', role: 'owner' };
    if (session.id === 'owner' && session.role === 'owner') return session;
    let accounts = [];
    try { accounts = JSON.parse(process.env.ADMIN_STAFF_ACCOUNTS || '[]'); } catch { return null; }
    return accounts.some(a => a.id === session.id && a.role === session.role) ? session : null;
  } catch {
    return false;
  }
}

export function adminCanAccess(principal, request) {
  if (!principal) return false;
  if (principal.role === 'owner') return true;
  const url = new URL(request.url);
  const path = url.pathname; const route = url.searchParams.get('route') || '';
  if (path.endsWith('/session')) return true;
  if (route.startsWith('ops-') || path.includes('/operations')) return request.method === 'GET' && route !== 'ops-audit';
  if (principal.role === 'viewer') return request.method === 'GET';
  if (principal.role === 'catalog') return /products|product-media|product-upload|promotions|reels/.test(path) && route !== 'reviews';
  if (principal.role === 'fulfillment') return path.endsWith('/orders') || (request.method === 'GET' && path.endsWith('/products'));
  if (principal.role === 'support') return path.endsWith('/inquiries') || route === 'reviews';
  return false;
}

export function isAdminRequest(request) { return adminCanAccess(readAdminSession(request), request); }
