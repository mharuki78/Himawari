import { HttpError, bindPasswordToggle, fetchJson } from './admin-client.js';

const $ = (selector) => document.querySelector(selector);
const initialView = $('[data-initial-view]');
const loginView = $('[data-login-view]');
const boardView = $('[data-board-view]');
const loginForm = $('[data-login-form]');
const passwordInput = $('#admin-password');
const passwordError = $('#admin-password-error');
const passwordToggle = $('[data-password-toggle]');
const loginButton = loginForm.querySelector('button[type="submit"]');
const loginLabel = $('[data-login-label]');
const loginStatus = $('[data-login-status]');
const logoutButton = $('[data-logout]');
const boardStatus = $('[data-board-status]');
const form = $('[data-promotion-form]');
const formStatus = $('[data-form-status]');
const saveButton = form.querySelector('button[type="submit"]');
const saveLabel = $('[data-save-label]');
const couponGrid = $('[data-coupon-admin-grid]');
let etag = null;
let config = null;

function showLogin(message = '') {
  initialView.hidden = true; boardView.hidden = true; loginView.hidden = false;
  loginStatus.textContent = message; passwordInput.value = ''; passwordInput.type = 'password';
  requestAnimationFrame(() => passwordInput.focus());
}

function showBoard() { initialView.hidden = true; loginView.hidden = true; boardView.hidden = false; }

function field(name) { return form.elements.namedItem(name); }
function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function numberField(card, coupon, key, labelText, value) {
  const wrapper = element('div', 'admin-field');
  const input = document.createElement('input');
  input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.max = '30000000'; input.step = '100'; input.value = String(value || 0);
  input.id = `${coupon.id}-${key}`; input.dataset[key === 'min' ? 'couponMin' : 'couponMax'] = '';
  const label = element('label', '', labelText); label.htmlFor = input.id;
  const error = element('p', 'field-error'); error.dataset[key === 'min' ? 'errorMin' : 'errorMax'] = '';
  wrapper.append(label, input, error); card.append(wrapper);
}

function couponCard(coupon) {
  const section = document.createElement('section');
  section.className = 'coupon-admin-card';
  section.dataset.couponId = coupon.id;
  const head = element('div', 'coupon-admin-card__head');
  const identity = document.createElement('div');
  identity.append(element('span', '', coupon.type === 'free_shipping' ? '배송 혜택' : `${coupon.rate}% 할인`), element('h3', '', coupon.label));
  const toggle = element('label', 'admin-switch');
  const active = document.createElement('input'); active.type = 'checkbox'; active.dataset.couponActive = ''; active.checked = coupon.active;
  toggle.append(active, element('span', '', '활성화')); head.append(identity, toggle); section.append(head);
  numberField(section, coupon, 'min', '최소 주문금액', coupon.minimumSubtotal);
  if (coupon.type === 'percent') numberField(section, coupon, 'max', '최대 할인금액', coupon.maximumDiscount);
  const expiryField = element('div', 'admin-field');
  const expiry = document.createElement('input'); expiry.type = 'datetime-local'; expiry.id = `${coupon.id}-expiry`; expiry.dataset.couponExpiry = ''; expiry.value = toLocalDateTime(coupon.expiresAt);
  const expiryLabel = element('label', '', '종료 일시'); expiryLabel.htmlFor = expiry.id;
  const help = element('p', 'field-help', '비워두면 관리자가 끌 때까지 유지됩니다.');
  const error = element('p', 'field-error'); error.dataset.errorExpiry = '';
  expiryField.append(expiryLabel, expiry, help, error); section.append(expiryField);
  return section;
}

function render(value) {
  config = value;
  field('popupEnabled').checked = value.popup.enabled;
  field('popupTitle').value = value.popup.title;
  field('popupMessage').value = value.popup.message;
  field('popupLinkLabel').value = value.popup.linkLabel;
  field('popupLinkUrl').value = value.popup.linkUrl;
  couponGrid.replaceChildren(...value.coupons.map(couponCard));
}

async function load() {
  try {
    const payload = await fetchJson('/api/admin/promotions', { cache: 'no-store' });
    etag = payload.etag || null; render(payload.config); showBoard();
    boardStatus.textContent = payload.config.updatedAt ? `마지막 저장: ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payload.config.updatedAt))}` : '아직 저장된 설정이 없습니다. 모든 쿠폰과 팝업은 비활성 상태입니다.';
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return showLogin();
    showBoard(); boardStatus.textContent = error.message || '프로모션 설정을 불러오지 못했습니다.';
  }
}

function collectCoupons() {
  return [...couponGrid.querySelectorAll('[data-coupon-id]')].map((card) => ({
    id: card.dataset.couponId,
    active: card.querySelector('[data-coupon-active]').checked,
    minimumSubtotal: Number(card.querySelector('[data-coupon-min]').value || 0),
    maximumDiscount: Number(card.querySelector('[data-coupon-max]')?.value || 0),
    expiresAt: card.querySelector('[data-coupon-expiry]').value ? new Date(card.querySelector('[data-coupon-expiry]').value).toISOString() : '',
  }));
}

function setErrors(errors = {}) {
  form.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
  const map = { popupTitle: '#popup-title-error', popupMessage: '#popup-message-error', popupLinkUrl: '#popup-link-url-error' };
  Object.entries(errors).forEach(([name, message]) => {
    if (map[name]) $(map[name]).textContent = message;
    const match = name.match(/^(shipping-free|discount-10|discount-15|discount-20)(Minimum|Maximum|ExpiresAt)$/);
    if (!match) return;
    const card = couponGrid.querySelector(`[data-coupon-id="${match[1]}"]`);
    const target = match[2] === 'Minimum' ? '[data-error-min]' : match[2] === 'Maximum' ? '[data-error-max]' : '[data-error-expiry]';
    card?.querySelector(target)?.append(document.createTextNode(message));
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!passwordInput.value) { passwordError.textContent = '관리자 비밀번호를 입력해 주세요.'; passwordInput.focus(); return; }
  loginButton.disabled = true; loginLabel.textContent = '로그인 확인 중'; loginStatus.textContent = '';
  try { await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: passwordInput.value }) }); await load(); }
  catch (error) { loginStatus.textContent = error.message || '로그인하지 못했습니다.'; passwordInput.select(); }
  finally { loginButton.disabled = false; loginLabel.textContent = '관리자 로그인'; }
});

bindPasswordToggle(passwordInput, passwordToggle);
logoutButton.addEventListener('click', async () => { await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' }); showLogin('안전하게 로그아웃했습니다.'); });

form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (saveButton.disabled) return;
  setErrors(); saveButton.disabled = true; saveLabel.textContent = '저장 중'; formStatus.textContent = '쿠폰과 팝업 설정을 저장하고 있습니다.';
  const next = {
    ...config,
    popup: { enabled: field('popupEnabled').checked, title: field('popupTitle').value, message: field('popupMessage').value, linkLabel: field('popupLinkLabel').value, linkUrl: field('popupLinkUrl').value },
    coupons: collectCoupons(),
  };
  try {
    const payload = await fetchJson('/api/admin/promotions', { method: 'PUT', body: JSON.stringify({ etag, config: next }) });
    etag = payload.etag; render(payload.config); formStatus.textContent = '프로모션 설정을 저장했습니다.'; boardStatus.textContent = '공개 사이트와 새 주문서에 최신 설정이 반영됩니다.';
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return showLogin('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.');
    setErrors(error.fieldErrors); formStatus.textContent = error.message || '설정을 저장하지 못했습니다.';
  } finally { saveButton.disabled = false; saveLabel.textContent = '프로모션 저장'; }
});

load();
