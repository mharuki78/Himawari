// KakaoPay Online v1. OAuth login credentials are never used for payments.
export const KAKAOPAY_ORIGIN = 'https://himawari.co.kr';
export const KAKAOPAY_CID = 'CT07417871';

export function kakaopayConfig(env = process.env) {
  const cid = env.KAKAOPAY_CID || KAKAOPAY_CID;
  const secret = env.KAKAOPAY_SECRET_KEY || '';
  const enabled = env.KAKAOPAY_ENABLED === 'true' && cid === KAKAOPAY_CID &&
    secret.length >= 20 && !secret.startsWith('DEV') && Boolean(env.DATABASE_URL) &&
    (env.MEMBER_SESSION_SECRET || '').length >= 32;
  return { enabled, cid, secret };
}

export function safePaymentRedirect(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'kakaopay.com' || url.hostname.endsWith('.kakaopay.com') ||
       url.hostname === 'kakao.com' || url.hostname.endsWith('.kakao.com'))) return url.href;
  } catch { /* Never redirect to an untrusted response URL. */ }
  throw Object.assign(new Error('결제창 주소를 확인하지 못했습니다.'), { status: 502 });
}

export async function callKakaopay(action, body, { config = kakaopayConfig(), fetcher = fetch } = {}) {
  if (!config.enabled) throw Object.assign(new Error('카카오페이 결제 연결을 준비하고 있습니다.'), { status: 503 });
  if (!['ready', 'approve', 'order', 'cancel'].includes(action)) throw new Error('Invalid payment action');
  let response;
  try {
    response = await fetcher(`https://open-api.kakaopay.com/online/v1/payment/${action}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `SECRET_KEY ${config.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, cid: config.cid }),
    });
  } catch {
    throw Object.assign(new Error('결제 결과를 확인하지 못했습니다. 같은 주문에서 다시 확인해 주세요.'), { status: 502, uncertain: true });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    // Do not expose provider payloads, credentials, pg_token or personal card information.
    throw Object.assign(new Error('카카오페이 요청을 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.'), {
      status: 502, providerCode: Number(result?.error_code) || null, uncertain: response.status >= 500 || !result,
    });
  }
  return result;
}

export function verifyPayment(result, session) {
  if (result.tid !== session.tid || result.cid !== session.cid ||
      result.partner_order_id !== session.order_number || result.partner_user_id !== session.partner_user_id ||
      !Number.isInteger(result.amount?.total) || result.amount.total !== Number(session.total)) {
    throw Object.assign(new Error('주문과 결제 결과가 일치하지 않습니다. 고객센터에 주문번호를 알려 주세요.'), { status: 409 });
  }
  return result;
}

export const UNPAID_TERMINAL = new Set(['QUIT_PAYMENT', 'FAIL_PAYMENT', 'FAIL_AUTH_PASSWORD']);
