import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;
const PROD_SESSION_COOKIE = '__Host-himawari_member';
const DEV_SESSION_COOKIE = 'himawari_member';
const PROD_OAUTH_COOKIE = '__Host-himawari_oauth';
const DEV_OAUTH_COOKIE = 'himawari_oauth';

function secureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}

function cookieName(request, kind) {
  if (kind === 'oauth') return secureRequest(request) ? PROD_OAUTH_COOKIE : DEV_OAUTH_COOKIE;
  return secureRequest(request) ? PROD_SESSION_COOKIE : DEV_SESSION_COOKIE;
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, value.join('=')]),
  );
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function secret() {
  return process.env.MEMBER_SESSION_SECRET || '';
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function encodeSigned(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function decodeSigned(value) {
  const [encoded, signature, ...rest] = String(value || '').split('.');
  if (!encoded || !signature || rest.length || !safeEqual(signature, sign(encoded))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function hashToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function cookieBase(request, sameSite = 'Lax') {
  return `Path=/; HttpOnly; SameSite=${sameSite}${secureRequest(request) ? '; Secure' : ''}`;
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email || '',
    displayName: row.display_name || 'Himawari 회원',
    avatarUrl: row.avatar_url || '',
    provider: row.provider || '',
  };
}

export function memberAuthIsConfigured() {
  return databaseIsConfigured() && secret().length >= 32;
}

export function providerIsConfigured(provider) {
  if (provider === 'naver') return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
  if (provider === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return false;
}

export function providerStatus() {
  return { naver: providerIsConfigured('naver'), google: providerIsConfigured('google') };
}

export function safeReturnTo(value) {
  const path = String(value || '/').trim();
  if (!path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path)) return '/';
  return path.slice(0, 1000);
}

export function createOAuthStateCookie(request, { provider, returnTo, verifier = '' }) {
  const state = randomBytes(24).toString('base64url');
  const payload = encodeSigned({
    version: 1,
    state,
    provider,
    returnTo: safeReturnTo(returnTo),
    verifier,
    expiresAt: Date.now() + OAUTH_TTL_SECONDS * 1000,
  });
  return {
    state,
    cookie: `${cookieName(request, 'oauth')}=${payload}; ${cookieBase(request)}; Max-Age=${OAUTH_TTL_SECONDS}`,
  };
}

export function readOAuthState(request, expectedProvider, providedState) {
  const value = parseCookies(request)[cookieName(request, 'oauth')];
  const payload = decodeSigned(value);
  if (!payload || payload.version !== 1 || payload.provider !== expectedProvider) return null;
  if (!safeEqual(payload.state, providedState) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
  return { ...payload, returnTo: safeReturnTo(payload.returnTo) };
}

export function clearOAuthCookies(request) {
  return [
    `${PROD_OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`,
    `${DEV_OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureRequest(request) ? '; Secure' : ''}`,
  ];
}

export async function upsertOAuthUser(profile) {
  const sql = database();
  const newUserId = randomUUID();
  const accountRows = await sql.query(
    `WITH existing AS (
       SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2
     ), inserted_user AS (
       INSERT INTO users (id, email, display_name, avatar_url, last_login_at)
       SELECT $3, $4, $5, $6, now() WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id
     ), account AS (
       INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, display_name, avatar_url, updated_at)
       SELECT $1, $2, COALESCE((SELECT user_id FROM existing), (SELECT id FROM inserted_user)), $4, $5, $6, now()
       ON CONFLICT (provider, provider_user_id) DO UPDATE
         SET email = EXCLUDED.email, display_name = EXCLUDED.display_name,
             avatar_url = EXCLUDED.avatar_url, updated_at = now()
       RETURNING user_id
     )
     SELECT user_id FROM account`,
    [profile.provider, profile.providerUserId, newUserId, profile.email || null, profile.displayName || null, profile.avatarUrl || null],
  );
  if (!accountRows[0]) throw Object.assign(new Error('사용할 수 없는 회원 계정입니다.'), { status: 403 });
  const rows = await sql.query(
    `UPDATE users
        SET email = $2, display_name = $3, avatar_url = $4,
            last_login_at = now(), updated_at = now()
      WHERE id = $1 AND status = 'active'
      RETURNING id, email, display_name, avatar_url`,
    [accountRows[0].user_id, profile.email || null, profile.displayName || null, profile.avatarUrl || null],
  );
  if (!rows[0]) throw Object.assign(new Error('사용할 수 없는 회원 계정입니다.'), { status: 403 });
  return publicUser({ ...rows[0], provider: profile.provider });
}

export async function createMemberSession(request, userId) {
  const sql = database();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await sql.transaction((tx) => [
    tx`DELETE FROM member_sessions WHERE expires_at <= now()`,
    tx`INSERT INTO member_sessions (id, user_id, token_hash, expires_at)
       VALUES (${randomUUID()}, ${userId}, ${hashToken(token)}, ${expiresAt.toISOString()})`,
  ]);
  return `${cookieName(request, 'session')}=${token}; ${cookieBase(request)}; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearMemberCookies(request) {
  return [
    `${PROD_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`,
    `${DEV_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureRequest(request) ? '; Secure' : ''}`,
  ];
}

export async function getMember(request) {
  if (!memberAuthIsConfigured()) return null;
  const token = parseCookies(request)[cookieName(request, 'session')];
  if (!token) return null;
  const sql = database();
  const rows = await sql.query(
    `SELECT u.id, u.email, u.display_name, u.avatar_url, oa.provider
       FROM member_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN LATERAL (
         SELECT provider FROM oauth_accounts WHERE user_id = u.id ORDER BY created_at LIMIT 1
       ) oa ON true
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'
      LIMIT 1`,
    [hashToken(token)],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function requireMember(request) {
  const member = await getMember(request);
  if (!member) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
  return member;
}

export async function revokeMemberSession(request) {
  const token = parseCookies(request)[cookieName(request, 'session')];
  if (!token || !databaseIsConfigured()) return;
  await database().query('DELETE FROM member_sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function deleteMemberAccount(userId) {
  await database().query('DELETE FROM users WHERE id = $1', [userId]);
}
