const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

export function methodNotAllowed(allowed) {
  return json({ message: '지원하지 않는 요청입니다.' }, 405, { Allow: allowed.join(', ') });
}

export function redirect(location, status = 302, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

export async function readJson(request, maxBytes = 16_384) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('JSON 요청만 허용됩니다.'), { status: 415 });
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    throw Object.assign(new Error('요청 내용이 너무 깁니다.'), { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw Object.assign(new Error('요청 내용이 너무 깁니다.'), { status: 413 });
  }

  try {
    return JSON.parse(text || '{}');
  } catch {
    throw Object.assign(new Error('요청 형식을 확인해 주세요.'), { status: 400 });
  }
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

export function blobIsConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}
