import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DURATION, VERSION, scoreRound } from '../../assets/rhythm-core.mjs';

function secret() {
  const value = process.env.MEMBER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value) throw Object.assign(new Error('게임 쿠폰 연결을 준비 중입니다.'), { status: 503 });
  return value;
}
function signature(value) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
export function startRhythmSession(owner, now = Date.now()) {
  const payload = { v: VERSION, owner, seed: randomBytes(4).readUInt32BE(), nonce: randomBytes(12).toString('hex'), started: now };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { session: `${encoded}.${signature(encoded)}`, seed: payload.seed, duration: DURATION, version: VERSION };
}
export function verifyRhythmSession(owner, input, now = Date.now()) {
  try {
    const [encoded, supplied, extra] = String(input?.session || '').split('.');
    if (extra || !encoded || !supplied || encoded.length > 600) throw Error();
    const expected = signature(encoded);
    if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw Error();
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (payload.owner !== owner || payload.v !== VERSION || !Number.isInteger(payload.seed) || !Number.isFinite(payload.started) ||
      now - payload.started < DURATION - 1000 || now - payload.started > 15 * 60_000) throw Error();
    const result = scoreRound(payload.seed, input.events, input.offset ?? 0);
    const date = new Date(payload.started + 9 * 3600_000).toISOString().slice(0, 10);
    return { result, campaign: `rhythm-${date}` };
  } catch (error) {
    if (error.status === 503) throw error;
    throw Object.assign(new Error('플레이 기록을 확인하지 못했습니다. 게임을 처음부터 다시 시작해 주세요.'), { status: 422 });
  }
}
export function rhythmCouponToken(owner, campaign, couponId) { return signature(`rhythm-coupon:${owner}:${campaign}:${couponId}`); }
