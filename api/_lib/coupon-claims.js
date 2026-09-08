import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { database } from './database.js';
import { activeCoupons, readPromotions } from './promotions.js';

const COOKIE = '__Host-himawari_coupon';
let schemaPromise;
function secret() { return process.env.MEMBER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || ''; }
function hash(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function sign(value) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function cookieValue(request) { const raw = request.headers.get('cookie') || ''; const match = raw.match(/(?:^|;\s*)(?:__Host-himawari_coupon|himawari_coupon)=([^;]+)/); return match ? decodeURIComponent(match[1]) : ''; }
function validOwner(raw) { const [id, signature] = String(raw).split('.'); if (!/^[a-f0-9]{32}$/.test(id || '') || !signature) return ''; const expected = sign(id); try { return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : ''; } catch { return ''; } }
function owner(request) { const existing = validOwner(cookieValue(request)); if (existing) return { id: existing, cookie: '' }; const id = randomBytes(16).toString('hex'); const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''; return { id, cookie: `${secure ? COOKIE : 'himawari_coupon'}=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}` }; }

async function ensureSchema() {
  if (!schemaPromise) schemaPromise = database()`CREATE TABLE IF NOT EXISTS coupon_claims (
    id text PRIMARY KEY, owner_hash text NOT NULL, campaign text NOT NULL, coupon_id text NOT NULL,
    token_hash text NOT NULL UNIQUE, issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
    used_at timestamptz, order_id text, UNIQUE(owner_hash,campaign)
  )`.catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function rewardIds(score) { if (score >= 2100) return ['discount-20','discount-15','discount-10','shipping-free']; if (score >= 1600) return ['discount-15','discount-10','shipping-free']; if (score >= 1000) return ['discount-10','shipping-free']; return ['shipping-free']; }

export async function claimCoupon(request, input) {
  await ensureSchema();
  const promotion = await readPromotions();
  const available = activeCoupons(promotion.config);
  const isGame = input?.source === 'game';
  let coupon;
  if (isGame) {
    const score = Math.max(0, Math.min(99999, Math.floor(Number(input?.score) || 0)));
    coupon = rewardIds(score).map((id) => available.find((item) => item.id === id)).find(Boolean);
    if (!coupon) throw Object.assign(new Error('현재 획득할 수 있는 게임 쿠폰이 없습니다.'), { status: 409 });
  } else coupon = available.find((item) => item.id === String(input?.couponId || ''));
  if (!coupon) throw Object.assign(new Error('종료되었거나 사용할 수 없는 쿠폰입니다.'), { status: 409 });
  const identity = owner(request);
  const campaign = isGame ? `game-${new Date().toISOString().slice(0, 10)}` : `public-${coupon.id}`;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = coupon.expiresAt && new Date(coupon.expiresAt) < new Date(Date.now() + 30 * 86400000) ? coupon.expiresAt : new Date(Date.now() + 30 * 86400000).toISOString();
  const rows = await database().query(
    `INSERT INTO coupon_claims (id,owner_hash,campaign,coupon_id,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (owner_hash,campaign) DO UPDATE SET coupon_id=EXCLUDED.coupon_id,token_hash=EXCLUDED.token_hash,issued_at=now(),expires_at=EXCLUDED.expires_at
       WHERE coupon_claims.used_at IS NULL RETURNING coupon_id,expires_at`,
    [randomUUID(), hash(identity.id), campaign, coupon.id, hash(token), expiresAt],
  );
  if (!rows[0]) throw Object.assign(new Error('이 이벤트 쿠폰은 이미 사용했습니다.'), { status: 409 });
  return { coupon, token, expiresAt: new Date(rows[0].expires_at).toISOString(), cookie: identity.cookie };
}

export async function consumeCouponClaim(couponId, token, orderId) {
  if (!couponId) return null;
  await ensureSchema();
  if (!token || String(token).length < 30) throw Object.assign(new Error('쿠폰을 다시 받은 뒤 주문해 주세요.'), { status: 409, fieldErrors: { couponId: '쿠폰 인증이 만료되었습니다. 다시 받아 주세요.' } });
  const rows = await database().query(
    `UPDATE coupon_claims SET used_at=COALESCE(used_at,now()),order_id=$1 WHERE token_hash=$2 AND coupon_id=$3 AND (used_at IS NULL OR order_id=$1) AND expires_at>now() RETURNING id`,
    [orderId, hash(token), couponId],
  );
  if (!rows[0]) throw Object.assign(new Error('이미 사용했거나 만료된 쿠폰입니다.'), { status: 409, fieldErrors: { couponId: '쿠폰을 다시 확인해 주세요.' } });
  return rows[0].id;
}

export async function releaseCouponClaim(orderId) { await ensureSchema(); await database().query('UPDATE coupon_claims SET used_at=NULL,order_id=NULL WHERE order_id=$1', [orderId]); }
