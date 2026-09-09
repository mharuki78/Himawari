import { createSupportReceipt, readSupportReceipt } from './_lib/support-receipt.js';
import { clientIp, blobIsConfigured, isSameOrigin, json, methodNotAllowed, readJson } from './_lib/http.js';
import { storeInquiry, validateInquiry, readInquiryStatus } from './_lib/inquiries.js';
import { supportContext } from './_lib/support.js';

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function allowed(ip) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  if (attempts.size > 500) {
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
  }
  return current.count <= MAX_ATTEMPTS;
}

export async function fetch(request) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!isSameOrigin(request)) return json({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
  if (!blobIsConfigured()) return json({ message: '문의 저장 기능을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.' }, 503);
  if (!allowed(clientIp(request))) return json({ message: '짧은 시간에 너무 많은 문의가 접수되었습니다. 잠시 후 다시 시도해 주세요.' }, 429);

  try {
    const input = await readJson(request, 2_900_000);
    if (input.action === 'status') {
      const id=readSupportReceipt(input.receipt);
      if(!id)return json({message:'접수 확인 링크가 올바르지 않거나 만료되었습니다.'},404);
      return json(await readInquiryStatus(id));
    }
    const { value, fieldErrors, valid } = validateInquiry(input);
    if (value.website) return json({ ok: true }, 201);
    if (!valid) return json({ message: '입력 내용을 확인해 주세요.', fieldErrors }, 400);

    const context = input.serviceType ? await supportContext(request, input) : {};
    const result = await storeInquiry({ ...value, ...context });
    return json({ ok: true, duplicate: !result.created, receipt: input.serviceType ? createSupportReceipt(value.requestId) : undefined }, result.created ? 201 : 200);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({ message: status < 500 ? error.message : '문의 저장 중 문제가 발생했습니다. 입력 내용은 유지되므로 잠시 후 다시 시도해 주세요.' }, status);
  }
}
