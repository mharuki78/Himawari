import { HttpError, bindPasswordToggle, fetchJson } from './admin-client.js';

(() => {
  const initialView = document.querySelector('[data-initial-view]');
  const loginView = document.querySelector('[data-login-view]');
  const boardView = document.querySelector('[data-board-view]');
  const loginForm = document.querySelector('[data-login-form]');
  const passwordInput = document.querySelector('#admin-password');
  const passwordError = document.querySelector('#admin-password-error');
  const passwordToggle = document.querySelector('[data-password-toggle]');
  const loginButton = loginForm.querySelector('button[type="submit"]');
  const loginLabel = document.querySelector('[data-login-label]');
  const loginStatus = document.querySelector('[data-login-status]');
  const logoutButton = document.querySelector('[data-logout]');
  const boardTitle = document.querySelector('#board-title');
  const boardStatus = document.querySelector('[data-board-status]');
  const tableWrap = document.querySelector('[data-table-wrap]');
  const rows = document.querySelector('[data-inquiry-rows]');
  const emptyState = document.querySelector('[data-empty-state]');
  const listError = document.querySelector('[data-list-error]');
  const retryButton = document.querySelector('[data-retry]');
  const errorRetryButton = document.querySelector('[data-error-retry]');
  const loadMoreButton = document.querySelector('[data-load-more]');
  const loadLabel = document.querySelector('[data-load-label]');
  const detailEmpty = document.querySelector('[data-detail-empty]');
  const detailContent = document.querySelector('[data-detail-content]');
  const detailSubject = document.querySelector('[data-detail-subject]');
  const detailDate = document.querySelector('[data-detail-date]');
  const detailName = document.querySelector('[data-detail-name]');
  const detailEmail = document.querySelector('[data-detail-email]');
  const detailMessage = document.querySelector('[data-detail-message]');
  const detailClose = document.querySelector('[data-detail-close]');
  const deleteTrigger = document.querySelector('[data-delete-trigger]');
  const deleteDialog = document.querySelector('[data-delete-dialog]');
  const deleteSubject = document.querySelector('[data-delete-subject]');
  const deleteError = document.querySelector('[data-delete-error]');
  const deleteCancel = document.querySelector('[data-delete-cancel]');
  const deleteConfirm = document.querySelector('[data-delete-confirm]');
  const deleteLabel = document.querySelector('[data-delete-label]');

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  });

  let inquiries = [];
  let cursor = null;
  let hasMore = false;
  let selected = null;
  let lastViewTrigger = null;
  let listController = null;
  let loadingList = false;

  function setLoginError(message) {
    passwordError.textContent = message;
    passwordInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function showLogin(message = '') {
    initialView.hidden = true;
    boardView.hidden = true;
    loginView.hidden = false;
    loginStatus.textContent = message;
    passwordInput.value = '';
    passwordInput.type = 'password';
    passwordToggle.textContent = '표시';
    passwordToggle.setAttribute('aria-label', '비밀번호 표시');
    passwordToggle.setAttribute('aria-pressed', 'false');
    window.requestAnimationFrame(() => passwordInput.focus());
  }

  function showBoard() {
    initialView.hidden = true;
    loginView.hidden = true;
    boardView.hidden = false;
  }

  function handleSessionError(error) {
    if (error instanceof HttpError && error.status === 401) {
      showLogin('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.');
      return true;
    }
    return false;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '날짜 정보 없음' : dateFormatter.format(date);
  }

  function cell(text, className = '') {
    const element = document.createElement('td');
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderRows() {
    rows.replaceChildren();
    inquiries.forEach((inquiry) => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      const time = document.createElement('time');
      time.dateTime = inquiry.createdAt;
      time.textContent = formatDate(inquiry.createdAt);
      dateCell.append(time);
      row.append(dateCell, cell(inquiry.subject, 'table-subject'), cell(inquiry.name), cell(inquiry.email, 'table-email'));

      const actionCell = document.createElement('td');
      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'button button--quiet view-button';
      viewButton.textContent = '문의 보기';
      viewButton.setAttribute('aria-label', `${inquiry.subject} 문의 보기`);
      viewButton.addEventListener('click', () => selectInquiry(inquiry, viewButton));
      actionCell.append(viewButton);
      row.append(actionCell);
      rows.append(row);
    });

    tableWrap.hidden = inquiries.length === 0;
    emptyState.hidden = inquiries.length !== 0 || loadingList;
    listError.hidden = true;
    loadMoreButton.hidden = !hasMore || inquiries.length === 0;
  }

  function clearDetail({ restoreFocus = false } = {}) {
    selected = null;
    detailContent.hidden = true;
    detailEmpty.hidden = false;
    if (restoreFocus && lastViewTrigger?.isConnected) lastViewTrigger.focus();
  }

  function selectInquiry(inquiry, trigger) {
    selected = inquiry;
    lastViewTrigger = trigger;
    detailSubject.textContent = inquiry.subject;
    detailDate.dateTime = inquiry.createdAt;
    detailDate.textContent = formatDate(inquiry.createdAt);
    detailName.textContent = inquiry.name;
    detailEmail.textContent = inquiry.email;
    detailMessage.textContent = inquiry.message;
    detailEmpty.hidden = true;
    detailContent.hidden = false;
    if (window.matchMedia('(max-width: 900px)').matches) detailSubject.scrollIntoView({ block: 'start' });
    detailClose.focus();
  }

  async function loadItems({ reset = false, initial = false } = {}) {
    if (loadingList) return;
    loadingList = true;
    listController?.abort();
    listController = new AbortController();
    const nextCursor = reset ? '' : cursor || '';

    if (!initial) {
      showBoard();
      boardStatus.textContent = reset ? '문의 목록을 새로 불러오고 있습니다.' : '이전 문의를 더 불러오고 있습니다.';
    }
    retryButton.disabled = true;
    retryButton.setAttribute('aria-busy', 'true');
    loadMoreButton.disabled = true;
    loadMoreButton.setAttribute('aria-busy', 'true');
    loadLabel.textContent = '문의 불러오는 중';

    try {
      const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : '';
      const payload = await fetchJson(`/api/admin/inquiries${query}`, { signal: listController.signal });
      if (reset) {
        inquiries = [];
        clearDetail();
      }
      inquiries = [...inquiries, ...payload.items.filter((item) => !inquiries.some((current) => current.pathname === item.pathname))];
      cursor = payload.nextCursor;
      hasMore = payload.hasMore;
      showBoard();
      renderRows();
      boardStatus.textContent = inquiries.length
        ? `${inquiries.length}건의 문의를 불러왔습니다.${hasMore ? ' 더 오래된 문의가 있습니다.' : ''}`
        : '접수된 문의가 없습니다.';
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (handleSessionError(error)) return;
      if (initial) showBoard();
      if (!inquiries.length) {
        tableWrap.hidden = true;
        emptyState.hidden = true;
        listError.hidden = false;
      }
      boardStatus.textContent = error.message || '문의 목록을 불러오지 못했습니다.';
    } finally {
      loadingList = false;
      retryButton.disabled = false;
      retryButton.removeAttribute('aria-busy');
      loadMoreButton.disabled = false;
      loadMoreButton.removeAttribute('aria-busy');
      loadLabel.textContent = '문의 20건 더 보기';
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loginButton.disabled) return;
    const password = passwordInput.value;
    if (!password) {
      setLoginError('관리자 비밀번호를 입력해 주세요.');
      passwordInput.focus();
      return;
    }

    setLoginError('');
    loginStatus.textContent = '관리자 권한을 확인하고 있습니다.';
    loginButton.disabled = true;
    loginButton.setAttribute('aria-busy', 'true');
    loginLabel.textContent = '로그인 확인 중';

    try {
      await fetchJson('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) });
      passwordInput.value = '';
      await loadItems({ reset: true });
    } catch (error) {
      loginStatus.textContent = error.message || '로그인 처리 중 문제가 발생했습니다.';
      if (error instanceof HttpError && error.status === 401) {
        setLoginError('관리자 비밀번호를 확인해 주세요.');
        passwordInput.select();
      }
    } finally {
      loginButton.disabled = false;
      loginButton.removeAttribute('aria-busy');
      loginLabel.textContent = '관리자 로그인';
    }
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.getAttribute('aria-invalid') === 'true') setLoginError('');
  });

  bindPasswordToggle(passwordInput, passwordToggle);

  logoutButton.addEventListener('click', async () => {
    if (logoutButton.disabled) return;
    logoutButton.disabled = true;
    logoutButton.setAttribute('aria-busy', 'true');
    try {
      await fetchJson('/api/admin/session', { method: 'DELETE', body: '{}' });
      inquiries = [];
      clearDetail();
      showLogin('안전하게 로그아웃했습니다.');
    } catch (error) {
      boardStatus.textContent = error.message || '로그아웃하지 못했습니다. 다시 시도해 주세요.';
    } finally {
      logoutButton.disabled = false;
      logoutButton.removeAttribute('aria-busy');
    }
  });

  retryButton.addEventListener('click', () => loadItems({ reset: true }));
  errorRetryButton.addEventListener('click', () => loadItems({ reset: true }));
  loadMoreButton.addEventListener('click', () => loadItems());
  detailClose.addEventListener('click', () => clearDetail({ restoreFocus: true }));

  deleteTrigger.addEventListener('click', () => {
    if (!selected) return;
    deleteSubject.textContent = selected.subject;
    deleteError.textContent = '';
    deleteDialog.showModal();
    deleteCancel.focus();
  });

  deleteCancel.addEventListener('click', () => deleteDialog.close());
  deleteDialog.addEventListener('cancel', () => {
    deleteError.textContent = '';
  });

  deleteConfirm.addEventListener('click', async () => {
    if (!selected || deleteConfirm.disabled) return;
    const target = selected;
    deleteConfirm.disabled = true;
    deleteConfirm.setAttribute('aria-busy', 'true');
    deleteCancel.disabled = true;
    deleteLabel.textContent = '삭제하는 중';
    deleteError.textContent = '';

    try {
      await fetchJson('/api/admin/inquiries', {
        method: 'DELETE',
        body: JSON.stringify({ pathname: target.pathname, etag: target.etag }),
      });
      deleteDialog.close();
      inquiries = inquiries.filter((item) => item.pathname !== target.pathname);
      clearDetail();
      renderRows();
      boardStatus.textContent = `“${target.subject}” 문의를 영구 삭제했습니다.`;
      const nextTarget = rows.querySelector('.view-button') || boardTitle;
      nextTarget.focus();
    } catch (error) {
      if (handleSessionError(error)) {
        deleteDialog.close();
        return;
      }
      deleteError.textContent = error.message || '문의를 삭제하지 못했습니다. 다시 시도하거나 취소해 주세요.';
    } finally {
      deleteConfirm.disabled = false;
      deleteConfirm.removeAttribute('aria-busy');
      deleteCancel.disabled = false;
      deleteLabel.textContent = '문의 삭제';
    }
  });

  loadItems({ reset: true, initial: true });
})();
