export class HttpError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function fetchJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status, payload.message || '요청을 처리하지 못했습니다.', payload.fieldErrors || {});
  return payload;
}

export function bindPasswordToggle(input, button) {
  button.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? '표시' : '숨기기';
    button.setAttribute('aria-label', showing ? '비밀번호 표시' : '비밀번호 숨기기');
    button.setAttribute('aria-pressed', String(!showing));
    input.focus();
  });
}

