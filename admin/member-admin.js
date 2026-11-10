import { bindPasswordToggle, fetchJson } from './admin-client.js';

const initial = document.querySelector('[data-initial-view]');
const login = document.querySelector('[data-login-view]');
const board = document.querySelector('[data-board-view]');
const loginForm = document.querySelector('[data-login-form]');
const password = document.querySelector('#member-admin-password');
const loginStatus = document.querySelector('[data-login-status]');
const filters = document.querySelector('[data-member-filters]');
const list = document.querySelector('[data-member-list]');
const status = document.querySelector('[data-member-status]');
const prev = document.querySelector('[data-member-prev]');
const next = document.querySelector('[data-member-next]');
const logout = document.querySelector('[data-logout]');
const providerLabels = { naver: '네이버', google: 'Google', kakao: '카카오' };
const dates = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' });
const date = value => value ? dates.format(new Date(value)) : '기록 없음';
let offset = 0;
let nextOffset = null;
let requestVersion = 0;

function showLogin(message) {
  requestVersion++;
  initial.hidden = board.hidden = true;
  login.hidden = false;
  list.replaceChildren();
  loginStatus.textContent = message;
  password.focus();
}

function renderMember(member) {
  const row = document.createElement('tr');
  const name = member.displayName || '이름 미등록';
  const cell = row.insertCell();
  cell.textContent = name;
  const email = document.createElement('small');
  email.textContent = member.email || '이메일 미등록';
  cell.append(email);
  const active = member.status === 'active';
  for (const text of [(member.providers || []).map(provider => providerLabels[provider] || provider).join(', ') || '기록 없음', date(member.createdAt), date(member.lastLoginAt), active ? '사용 중' : '사용 중지']) row.insertCell().textContent = text;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'button button--quiet';
  button.textContent = active ? '사용 중지' : '다시 사용';
  button.setAttribute('aria-label', `${name} 계정 ${button.textContent}`);
  button.addEventListener('click', async () => {
    if (active && !window.confirm(`${name} 회원의 사용을 중지할까요? 현재 로그인도 종료됩니다.`)) return;
    button.disabled = true;
    try {
      await fetchJson('/api/admin/members', { method: 'PATCH', body: JSON.stringify({ id: member.id, status: active ? 'disabled' : 'active', expectedStatus: member.status }) });
      await load(offset, active ? '계정 사용을 중지했습니다.' : '계정을 다시 사용할 수 있습니다.');
    } catch (error) {
      if (error.status === 401 || error.status === 403) showLogin('소유자 계정으로 로그인해 주세요.');
      else status.textContent = error.message;
    } finally { button.disabled = false; }
  });
  row.insertCell().append(button);
  return row;
}

async function load(position = 0, message = '') {
  const version = ++requestVersion;
  const params = new URLSearchParams({ q: filters.elements.query.value.trim(), status: filters.elements.status.value, offset: String(position) });
  prev.disabled = next.disabled = true;
  status.textContent = '회원 목록을 불러오고 있습니다.';
  try {
    const data = await fetchJson('/api/admin/members?' + params);
    if (version !== requestVersion) return;
    if (!data.items.length && position > 0) return load(Math.max(0, position - 25), message);
    initial.hidden = login.hidden = true; board.hidden = false;
    offset = position; nextOffset = data.nextOffset;
    list.replaceChildren(...data.items.map(renderMember));
    status.textContent = message || (data.items.length ? `회원 ${offset + 1}–${offset + data.items.length}번째` : '조건에 맞는 가입 회원이 없습니다.');
    prev.disabled = offset === 0; next.disabled = nextOffset === null;
  } catch (error) {
    if (version !== requestVersion) return;
    if (error.status === 401 || error.status === 403 || board.hidden) showLogin(error.message);
    else status.textContent = error.message;
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: password.value }) });
    password.value = '';
    await load();
  } catch (error) { loginStatus.textContent = error.message; }
  finally { button.disabled = false; }
});
bindPasswordToggle(password, document.querySelector('[data-password-toggle]'));
filters.addEventListener('submit', event => { event.preventDefault(); void load(); });
prev.addEventListener('click', () => void load(Math.max(0, offset - 25)));
next.addEventListener('click', () => { if (nextOffset !== null) void load(nextOffset); });
logout.addEventListener('click', async () => {
  try {
    await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' });
    filters.reset(); showLogin('로그아웃했습니다.');
  } catch (error) { status.textContent = error.message; }
});
void load();
