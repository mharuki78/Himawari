import { BlobPreconditionFailedError, del, get, head, list, put } from '@vercel/blob';

const PREFIX = 'inquiries/v1/';
const REQUEST_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH_PATTERN = /^inquiries\/v1\/\d{13}-[0-9a-f-]{36}\.json$/i;

function singleLine(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function multiLine(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

export function validateInquiry(input) {
  const value = {
    requestId: singleLine(input.requestId),
    name: singleLine(input.name),
    email: singleLine(input.email).toLowerCase(),
    subject: singleLine(input.subject),
    message: multiLine(input.message),
    consent: input.consent === true,
    website: singleLine(input.website),
  };
  const fieldErrors = {};

  if (!value.name) fieldErrors.name = '이름을 입력해 주세요.';
  else if (value.name.length > 60) fieldErrors.name = '이름은 60자 이내로 입력해 주세요.';
  if (!value.email) fieldErrors.email = '답변을 받을 이메일을 입력해 주세요.';
  else if (value.email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) fieldErrors.email = '이메일 주소 형식을 확인해 주세요.';
  if (!value.subject) fieldErrors.subject = '문의 제목을 입력해 주세요.';
  else if (value.subject.length > 120) fieldErrors.subject = '문의 제목은 120자 이내로 입력해 주세요.';
  if (!value.message) fieldErrors.message = '문의 내용을 입력해 주세요.';
  else if (value.message.length < 10) fieldErrors.message = '문의 내용을 10자 이상 입력해 주세요.';
  else if (value.message.length > 4000) fieldErrors.message = '문의 내용은 4,000자 이내로 입력해 주세요.';
  if (!value.consent) fieldErrors.consent = '문의 접수를 위해 보관 안내에 동의해 주세요.';

  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export async function storeInquiry(value) {
  if (!REQUEST_ID_PATTERN.test(value.requestId)) {
    throw Object.assign(new Error('요청 식별자가 올바르지 않습니다.'), { status: 400 });
  }

  const pathname = `${PREFIX}${value.requestId}.json`;
  const record = {
    version: 1,
    id: value.requestId.slice(14),
    createdAt: new Date().toISOString(),
    name: value.name,
    email: value.email,
    subject: value.subject,
    message: value.message,
    retention: 'until-admin-deletes',
  };

  try {
    await put(pathname, JSON.stringify(record), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: 60,
    });
    return { created: true, id: record.id };
  } catch (error) {
    try {
      const existing = await head(pathname);
      if (existing?.pathname === pathname) return { created: false, id: record.id };
    } catch {
      // The original write error remains authoritative when no existing blob can be verified.
    }
    throw error;
  }
}

async function readInquiry(blob) {
  const result = await get(blob.pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const record = JSON.parse(await new Response(result.stream).text());
  return { ...record, pathname: blob.pathname, etag: blob.etag };
}

export async function listInquiries(cursor) {
  const page = await list({ prefix: PREFIX, limit: 20, cursor: cursor || undefined });
  const records = await Promise.allSettled(page.blobs.map(readInquiry));
  const items = records
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);

  return { items, hasMore: page.hasMore, nextCursor: page.cursor || null };
}

export async function deleteInquiry(pathname, etag) {
  if (!PATH_PATTERN.test(pathname || '') || typeof etag !== 'string' || !etag) {
    throw Object.assign(new Error('삭제할 문의를 확인할 수 없습니다.'), { status: 400 });
  }
  await del(pathname, { ifMatch: etag });
}

export { BlobPreconditionFailedError };
