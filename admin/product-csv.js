import { animate } from 'animejs';
import { fetchJson } from './admin-client.js';

const maxBytes = 2_000_000;
const number = new Intl.NumberFormat('ko-KR');

export function bindProductCsv({ getEtag, canApply, onApplied, onSessionError }) {
  const $ = (selector) => document.querySelector(selector);
  const download = $('[data-bulk-download]');
  const upload = $('[data-bulk-upload]');
  const fileInput = $('[data-bulk-file]');
  const panel = $('[data-csv-preview]');
  const heading = $('[data-csv-title]');
  const summary = $('[data-csv-summary]');
  const status = $('[data-csv-status]');
  const errors = $('[data-csv-errors]');
  const tableWrap = $('[data-csv-table-wrap]');
  const rows = $('[data-csv-rows]');
  const apply = $('[data-csv-apply]');
  const cancel = $('[data-csv-cancel]');
  let pending = null;
  let busy = false;
  let animation;
  let generation = 0;

  function setBusy(value) {
    busy = value;
    download.disabled = value;
    upload.disabled = value;
    fileInput.disabled = value;
    cancel.disabled = value;
    apply.disabled = value || !pending?.updated;
    panel.setAttribute('aria-busy', String(value));
  }
  function clear() {
    generation += 1;
    animation?.revert();
    pending = null;
    fileInput.value = '';
    cancel.textContent = '취소';
    panel.hidden = true;
    status.textContent = '';
    errors.replaceChildren();
    rows.replaceChildren();
    setBusy(false);
  }
  function show() {
    const wasHidden = panel.hidden;
    panel.hidden = false;
    if (wasHidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation?.revert();
      animation = animate(panel, { opacity: [0, 1], translateY: [4, 0], duration: 170, ease: 'outQuad' });
    }
    heading.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }
  function report(error) {
    pending = null;
    if (onSessionError(error)) return;
    summary.textContent = 'CSV를 반영하지 못했습니다.';
    status.textContent = error.message || '파일을 확인한 뒤 다시 올려 주세요.';
    status.classList.add('is-error');
    tableWrap.hidden = true;
    errors.replaceChildren();
    for (const [field, message] of Object.entries(error.fieldErrors || {})) {
      const item = document.createElement('li');
      item.textContent = `${field}: ${message}`;
      errors.append(item);
    }
    show();
  }
  const display = (field, value) => value === null ? (field === '재고수량' ? '수량 제한 없음' : '미설정')
    : `${number.format(value)}${field === '판매가' ? '원' : field === '네이버할인율' ? '%' : '개'}`;

  download.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    const boardStatus = $('[data-board-status]');
    boardStatus.textContent = '가격·재고 CSV를 준비하고 있습니다.';
    try {
      const payload = await fetchJson('/api/admin/products/bulk');
      const url = URL.createObjectURL(new Blob([payload.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `himawari-price-stock-${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      boardStatus.textContent = '가격·재고 CSV를 내려받았습니다. 수정 후 CSV로 저장해 올려 주세요.';
    } catch (error) { if (!onSessionError(error)) boardStatus.textContent = error.message || 'CSV를 준비하지 못했습니다.'; }
    finally { setBusy(false); }
  });
  upload.addEventListener('click', () => { if (!busy) fileInput.click(); });
  cancel.addEventListener('click', () => { clear(); upload.focus(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file || busy) return;
    clear();
    const attempt = generation;
    setBusy(true);
    try {
      if (!canApply()) throw new Error('오른쪽 제품 양식의 변경 내용을 저장하거나 취소한 뒤 CSV를 올려 주세요.');
      if (!/\.csv$/i.test(file.name) || file.size > maxBytes) throw new Error('2MB 이하의 CSV 파일을 선택해 주세요. 엑셀 파일은 CSV로 저장해야 합니다.');
      const bytes = await file.arrayBuffer();
      let csv;
      try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { csv = new TextDecoder('euc-kr', { fatal: true }).decode(bytes); }
      const preview = await fetchJson('/api/admin/products/bulk', { method: 'POST', body: JSON.stringify({ csv, etag: getEtag() }) });
      if (attempt !== generation) return;
      pending = { ...preview, csv };
      summary.textContent = `${preview.submitted}개 제품 확인 · ${preview.updated}개 제품, ${preview.changes.length}개 항목 변경`;
      status.classList.remove('is-error');
      status.textContent = preview.updated ? `${file.name} · 아래 변경 내용을 확인한 뒤 반영해 주세요. 아직 저장되지 않았습니다.` : '현재 정보와 같습니다. 반영할 변경 내용이 없습니다.';
      tableWrap.hidden = !preview.changes.length;
      rows.replaceChildren();
      for (const change of preview.changes) {
        const tr = document.createElement('tr');
        for (const value of [String(change.row), `${change.model} · ${change.name}${change.option ? ` / ${change.option}` : ''}`, change.field, display(change.field, change.before), display(change.field, change.after)]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.append(td);
        }
        rows.append(tr);
      }
      apply.textContent = `${preview.updated}개 제품 반영`;
      show();
    } catch (error) { if (attempt === generation) report(error); }
    finally { if (attempt === generation) { fileInput.value = ''; setBusy(false); } }
  });
  apply.addEventListener('click', async () => {
    if (busy || !pending?.updated) return;
    setBusy(true);
    try {
      if (!canApply()) throw new Error('오른쪽 제품 양식의 변경 내용을 저장하거나 취소한 뒤 CSV를 다시 올려 주세요.');
      status.textContent = '가격·재고를 반영하고 있습니다. 잠시 기다려 주세요.';
      const result = await fetchJson('/api/admin/products/bulk', { method: 'PUT', body: JSON.stringify({ csv: pending.csv, etag: pending.etag }) });
      pending = null;
      await onApplied();
      summary.textContent = `${result.updated}개 제품 반영 완료`;
      status.textContent = '판매가와 재고를 저장했습니다. 제품 목록과 상세페이지에 함께 반영됩니다.';
      status.classList.remove('is-error');
      apply.textContent = '반영 완료';
      cancel.textContent = '닫기';
      show();
    } catch (error) { report(error); }
    finally { setBusy(false); }
  });
  window.addEventListener('pagehide', () => animation?.revert(), { once: true });
  return { clear };
}
