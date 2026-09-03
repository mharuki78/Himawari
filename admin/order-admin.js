import { HttpError, bindPasswordToggle, fetchJson } from './admin-client.js';

const initialView = document.querySelector('[data-initial-view]');
const loginView = document.querySelector('[data-login-view]');
const boardView = document.querySelector('[data-board-view]');
const loginForm = document.querySelector('[data-login-form]');
const passwordInput = document.querySelector('#admin-password');
const passwordToggle = document.querySelector('[data-password-toggle]');
const loginButton = loginForm.querySelector('button[type="submit"]');
const loginLabel = document.querySelector('[data-login-label]');
const loginStatus = document.querySelector('[data-login-status]');
const logoutButton = document.querySelector('[data-logout]');
const boardStatus = document.querySelector('[data-board-status]');
const rows = document.querySelector('[data-order-rows]');
const tableWrap = document.querySelector('[data-order-table-wrap]');
const emptyState = document.querySelector('[data-order-empty]');
const errorState = document.querySelector('[data-order-error]');
const errorMessage = document.querySelector('[data-order-error-message]');
const retryButton = document.querySelector('[data-retry]');
const errorRetryButton = document.querySelector('[data-error-retry]');
const statusFilter = document.querySelector('[data-order-filter]');
const totalLabel = document.querySelector('[data-order-total]');
const rangeLabel = document.querySelector('[data-order-range]');
const pageLabel = document.querySelector('[data-order-page]');
const previousButton = document.querySelector('[data-order-previous]');
const nextButton = document.querySelector('[data-order-next]');
const detailEmpty = document.querySelector('[data-order-detail-empty]');
const detail = document.querySelector('[data-order-detail]');
const updateForm = document.querySelector('[data-order-update-form]');
const updateStatus = document.querySelector('[data-order-update-status]');
const updateButton = updateForm.querySelector('button[type="submit"]');
const updateLabel = document.querySelector('[data-order-update-label]');
const orderStatusSelect = document.querySelector('[data-order-status]');
const trackingInput = document.querySelector('#tracking-number');
const noteInput = document.querySelector('#order-note');
const confirmDialog = document.querySelector('[data-order-confirm-dialog]');
const confirmTitle = document.querySelector('[data-order-confirm-title]');
const confirmDescription = document.querySelector('[data-order-confirm-description]');
const confirmError = document.querySelector('[data-order-confirm-error]');
const confirmCancel = document.querySelector('[data-order-confirm-cancel]');
const confirmButton = document.querySelector('[data-order-confirm]');
const confirmLabel = document.querySelector('[data-order-confirm-label]');
const priceFormatter = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const statusLabels = {
  payment_pending: '결제 대기', confirmed: '주문 확인', preparing: '배송 준비', shipped: '배송 중', delivered: '배송 완료',
  cancel_requested: '취소 요청', cancelled: '취소 완료', refund_requested: '반품·환불 요청', refunded: '환불 완료'
};
let orders = [];
let page = Math.max(1, Number.parseInt(new URLSearchParams(location.search).get('page') || '1', 10) || 1);
let pageCount = 1;
let total = 0;
let selected = null;
let listController;
let pendingUpdate = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setLoginError(message) {
  document.querySelector('#admin-password-error').textContent = message || '';
  passwordInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function showLogin(message = '') {
  initialView.hidden = true;
  boardView.hidden = true;
  loginView.hidden = false;
  loginStatus.textContent = message;
  passwordInput.focus();
}

function showBoard() {
  initialView.hidden = true;
  loginView.hidden = true;
  boardView.hidden = false;
}

function handleSessionError(error) {
  if (!(error instanceof HttpError) || error.status !== 401) return false;
  showLogin('관리자 세션이 끝났습니다. 다시 로그인해 주세요.');
  return true;
}

function updateUrl() {
  const params = new URLSearchParams();
  if (statusFilter.value) params.set('status', statusFilter.value);
  if (page > 1) params.set('page', String(page));
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
}

function renderRows() {
  rows.replaceChildren();
  orders.forEach((order) => {
    const row = document.createElement('tr');
    if (selected?.orderNumber === order.orderNumber) row.classList.add('is-selected');
    const identity = document.createElement('td');
    identity.append(node('strong', '', order.orderNumber), node('span', '', dateFormatter.format(new Date(order.createdAt))));
    const customer = document.createElement('td');
    customer.append(node('strong', '', order.recipient.name), node('span', '', order.recipient.phone));
    const amount = node('td', 'order-table__amount', priceFormatter.format(order.total));
    const state = document.createElement('td');
    const badge = node('span', 'order-status-badge', order.statusLabel);
    badge.dataset.status = order.status;
    state.append(badge);
    const action = document.createElement('td');
    const button = node('button', 'button button--quiet', '상세 보기');
    button.type = 'button';
    button.setAttribute('aria-label', `${order.orderNumber} 주문 상세 보기`);
    if (selected?.orderNumber === order.orderNumber) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => selectOrder(order, button));
    action.append(button);
    row.append(identity, customer, amount, state, action);
    rows.append(row);
  });
  tableWrap.hidden = orders.length === 0;
  emptyState.hidden = orders.length !== 0;
  errorState.hidden = true;
  totalLabel.textContent = String(total);
  const first = total ? (page - 1) * 20 + 1 : 0;
  const last = Math.min(page * 20, total);
  rangeLabel.textContent = total ? `${first}–${last} / ${total}건` : '0건';
  pageLabel.textContent = `${page} / ${pageCount}`;
  previousButton.disabled = page <= 1;
  nextButton.disabled = page >= pageCount;
}

function definitionRow(term, description) {
  const row = document.createElement('div');
  row.append(node('dt', '', term), node('dd', '', description));
  return row;
}

function selectOrder(order, trigger) {
  selected = order;
  renderRows();
  detailEmpty.hidden = true;
  detail.hidden = false;
  document.querySelector('[data-detail-number]').textContent = order.orderNumber;
  document.querySelector('[data-detail-date]').textContent = dateFormatter.format(new Date(order.createdAt));
  const detailStatus = document.querySelector('[data-detail-status]');
  detailStatus.textContent = order.statusLabel;
  detailStatus.dataset.status = order.status;
  const itemList = document.querySelector('[data-detail-items]');
  itemList.replaceChildren();
  order.items.forEach((item) => {
    const line = node('div', 'order-detail-item');
    line.append(node('strong', '', `${item.name} × ${item.quantity}`), node('span', '', `${priceFormatter.format(item.unitPrice)} · ${priceFormatter.format(item.lineTotal)}`));
    itemList.append(line);
  });
  document.querySelector('[data-detail-subtotal]').textContent = priceFormatter.format(order.subtotal);
  document.querySelector('[data-detail-shipping]').textContent = order.shippingFee ? priceFormatter.format(order.shippingFee) : '무료';
  document.querySelector('[data-detail-total]').textContent = priceFormatter.format(order.total);
  const recipient = document.querySelector('[data-detail-recipient]');
  recipient.replaceChildren(
    definitionRow('받는 분', order.recipient.name), definitionRow('연락처', order.recipient.phone), definitionRow('이메일', order.recipient.email),
    definitionRow('배송지', `(${order.recipient.postalCode}) ${order.recipient.addressLine1}${order.recipient.addressLine2 ? ` ${order.recipient.addressLine2}` : ''}`),
    definitionRow('배송 요청사항', order.recipient.deliveryNote || '없음'), definitionRow('배송', order.delivery.trackingNumber ? `${order.delivery.carrier} ${order.delivery.trackingNumber}` : `${order.delivery.carrier} · 운송장 등록 전`)
  );
  const events = document.querySelector('[data-detail-events]');
  events.replaceChildren();
  order.events.forEach((event) => {
    const item = document.createElement('li');
    item.append(node('strong', '', event.statusLabel), node('time', '', dateFormatter.format(new Date(event.createdAt))));
    if (event.note) item.append(node('p', '', event.note));
    events.append(item);
  });
  orderStatusSelect.replaceChildren();
  [order.status, ...order.allowedTransitions].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = statusLabels[value];
    orderStatusSelect.append(option);
  });
  orderStatusSelect.value = order.status;
  trackingInput.value = order.delivery.trackingNumber || '';
  noteInput.value = '';
  updateStatus.textContent = '';
  document.querySelector('#tracking-number-error').textContent = '';
  trackingInput.setAttribute('aria-invalid', 'false');
  document.querySelector('[data-detail-number]').focus();
}

async function loadOrders({ preserveSelection = false } = {}) {
  listController?.abort();
  listController = new AbortController();
  retryButton.disabled = true;
  boardStatus.textContent = '주문 목록을 불러오는 중입니다.';
  const currentNumber = preserveSelection ? selected?.orderNumber : '';
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter.value) params.set('status', statusFilter.value);
    const payload = await fetchJson(`/api/admin/orders?${params}`, { signal: listController.signal });
    orders = payload.items;
    total = payload.total;
    pageCount = payload.pageCount;
    if (page > pageCount) { page = pageCount; updateUrl(); return loadOrders({ preserveSelection }); }
    showBoard();
    if (currentNumber) selected = orders.find((order) => order.orderNumber === currentNumber) || null;
    else selected = null;
    renderRows();
    if (selected) {
      const trigger = [...rows.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === `${selected.orderNumber} 주문 상세 보기`);
      selectOrder(selected, trigger || rows.querySelector('button'));
    }
    else { detail.hidden = true; detailEmpty.hidden = false; }
    boardStatus.textContent = total ? `주문 ${total}건을 확인할 수 있습니다.` : '접수된 주문이 없습니다.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (handleSessionError(error)) return;
    showBoard();
    orders = [];
    rows.replaceChildren();
    tableWrap.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = false;
    errorMessage.textContent = error.message || '주문 목록을 불러오지 못했습니다.';
    boardStatus.textContent = '주문 목록을 불러오지 못했습니다.';
  } finally {
    retryButton.disabled = false;
  }
}

function updatePayload() {
  return {
    orderNumber: selected.orderNumber,
    status: orderStatusSelect.value,
    trackingNumber: trackingInput.value,
    note: noteInput.value,
    revision: selected.revision
  };
}

async function applyUpdate(payload) {
  updateButton.disabled = true;
  updateButton.setAttribute('aria-busy', 'true');
  updateLabel.textContent = '저장 중';
  updateStatus.textContent = '주문 상태를 확인하고 저장하고 있습니다.';
  try {
    const result = await fetchJson('/api/admin/orders', { method: 'PATCH', body: JSON.stringify(payload) });
    selected = result.order;
    await loadOrders({ preserveSelection: true });
    boardStatus.textContent = `${result.order.orderNumber} 주문을 ${result.order.statusLabel}(으)로 변경했습니다.`;
  } catch (error) {
    if (handleSessionError(error)) return;
    if (error.fieldErrors?.trackingNumber) {
      document.querySelector('#tracking-number-error').textContent = error.fieldErrors.trackingNumber;
      trackingInput.setAttribute('aria-invalid', 'true');
      trackingInput.focus();
    }
    updateStatus.textContent = error.message || '주문 변경을 저장하지 못했습니다.';
    throw error;
  } finally {
    updateButton.disabled = false;
    updateButton.removeAttribute('aria-busy');
    updateLabel.textContent = '주문 변경 저장';
  }
}

updateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selected || updateButton.disabled) return;
  document.querySelector('#tracking-number-error').textContent = '';
  trackingInput.setAttribute('aria-invalid', 'false');
  const payload = updatePayload();
  if (payload.status === 'shipped' && payload.trackingNumber.trim().length < 5) {
    document.querySelector('#tracking-number-error').textContent = '배송 중으로 변경하려면 운송장 번호를 입력해 주세요.';
    trackingInput.setAttribute('aria-invalid', 'true');
    trackingInput.focus();
    return;
  }
  if (payload.status === 'cancelled' || payload.status === 'refunded') {
    pendingUpdate = payload;
    const refund = payload.status === 'refunded';
    confirmTitle.textContent = refund ? '실제 환불 처리를 완료했나요?' : '주문 취소를 완료할까요?';
    confirmDescription.textContent = refund
      ? `${selected.orderNumber} 주문의 대금을 실제 결제수단에서 환불한 경우에만 완료로 변경하세요. 이 사이트는 PG와 자동으로 연동되지 않습니다.`
      : `${selected.orderNumber} 주문을 취소 완료로 변경합니다. 이미 대금을 받았다면 별도 환불 처리도 확인해야 합니다.`;
    confirmLabel.textContent = refund ? '환불 완료 기록' : '취소 완료 기록';
    confirmError.textContent = '';
    confirmDialog.showModal();
    confirmCancel.focus();
    return;
  }
  try { await applyUpdate(payload); } catch {}
});

confirmCancel.addEventListener('click', () => { pendingUpdate = null; confirmDialog.close(); });
confirmButton.addEventListener('click', async () => {
  if (!pendingUpdate || confirmButton.disabled) return;
  confirmButton.disabled = true;
  confirmCancel.disabled = true;
  confirmButton.setAttribute('aria-busy', 'true');
  confirmError.textContent = '';
  try {
    await applyUpdate(pendingUpdate);
    pendingUpdate = null;
    confirmDialog.close();
  } catch (error) {
    confirmError.textContent = error.message || '주문 상태를 변경하지 못했습니다.';
  } finally {
    confirmButton.disabled = false;
    confirmCancel.disabled = false;
    confirmButton.removeAttribute('aria-busy');
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginButton.disabled) return;
  if (!passwordInput.value) { setLoginError('관리자 비밀번호를 입력해 주세요.'); passwordInput.focus(); return; }
  setLoginError('');
  loginButton.disabled = true;
  loginButton.setAttribute('aria-busy', 'true');
  loginLabel.textContent = '로그인 확인 중';
  loginStatus.textContent = '관리자 권한을 확인하고 있습니다.';
  try {
    await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: passwordInput.value }) });
    passwordInput.value = '';
    await loadOrders();
    document.querySelector('#board-title').focus();
  } catch (error) {
    loginStatus.textContent = error.message || '로그인 처리 중 문제가 발생했습니다.';
    if (error instanceof HttpError && error.status === 401) { setLoginError('관리자 비밀번호를 확인해 주세요.'); passwordInput.select(); }
  } finally {
    loginButton.disabled = false;
    loginButton.removeAttribute('aria-busy');
    loginLabel.textContent = '관리자 로그인';
  }
});

passwordInput.addEventListener('input', () => { if (passwordInput.getAttribute('aria-invalid') === 'true') setLoginError(''); });
bindPasswordToggle(passwordInput, passwordToggle);
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try { await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' }); showLogin('안전하게 로그아웃했습니다.'); }
  catch (error) { boardStatus.textContent = error.message || '로그아웃하지 못했습니다.'; }
  finally { logoutButton.disabled = false; }
});
statusFilter.value = new URLSearchParams(location.search).get('status') || '';
statusFilter.addEventListener('change', () => { page = 1; updateUrl(); loadOrders(); });
previousButton.addEventListener('click', () => { if (page > 1) { page -= 1; updateUrl(); loadOrders(); } });
nextButton.addEventListener('click', () => { if (page < pageCount) { page += 1; updateUrl(); loadOrders(); } });
retryButton.addEventListener('click', () => loadOrders({ preserveSelection: true }));
errorRetryButton.addEventListener('click', () => loadOrders());
loadOrders();
