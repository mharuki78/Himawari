import { fetchJson } from './admin-client.js';

const formatPrice = new Intl.NumberFormat('ko-KR');
const formatState = { inactive: '사용 안 함', scheduled: '시작 예정', open: '진행 중', closed: '종료' };
const kst = value => value ? new Date(Date.parse(value) + 9 * 3600_000).toISOString().slice(0, 16) : '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function labeled(label, input) {
  const field = element('label', 'admin-field');
  field.append(element('span', '', label), input);
  return field;
}

export function setupBlackFridayAdmin(onUnauthorized) {
  const form = document.querySelector('[data-black-friday-form]');
  const list = form.querySelector('[data-bf-items]');
  const status = form.querySelector('[data-bf-status]');
  const add = form.querySelector('[data-bf-add]');
  const save = form.querySelector('[data-bf-save]');
  const reload = form.querySelector('[data-bf-reload]');
  const enabled = form.elements.namedItem('enabled');
  const starts = form.elements.namedItem('startsAt');
  const ends = form.elements.namedItem('endsAt');
  let catalog = [], revision = 0, ready = false, busy = false;

  function sync() {
    save.disabled = enabled.disabled = starts.disabled = ends.disabled = !ready || busy;
    add.disabled = save.disabled || !catalog.length || list.querySelectorAll('fieldset').length >= 100;
    reload.disabled = busy;
    list.querySelectorAll('fieldset').forEach(row => { row.disabled = busy || !ready; });
  }

  function addRow(item = {}) {
    list.querySelector('[data-bf-empty]')?.remove();
    const row = element('fieldset', 'black-friday-admin__item');
    const title = element('legend', 'sr-only', '행사 품목');
    const product = element('select'); product.required = true;
    const placeholder = element('option', '', '상품과 옵션 선택'); placeholder.value = ''; product.append(placeholder);
    const products = new Map();
    catalog.forEach((entry, i) => {
      if (!products.has(entry.productId)) {
        const group = document.createElement('optgroup'); group.label = [entry.model, entry.name].filter(Boolean).join(' · ');
        products.set(entry.productId, group); product.append(group);
      }
      const choice = element('option', '', `${entry.optionLabel || entry.name} · ${formatPrice.format(entry.regularPrice)}원`);
      choice.value = String(i); products.get(entry.productId).append(choice);
      if (entry.productId === item.productId && entry.optionId === item.optionId) product.value = choice.value;
    });
    const original = product.value;
    const price = element('input'); price.type = 'number'; price.min = '1'; price.step = '1'; price.required = true; price.value = item.price ?? '';
    const quantity = element('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = '99999'; quantity.step = '1'; quantity.required = true; quantity.value = item.quantity ?? '';
    const remove = element('button', 'button button--quiet', '삭제'); remove.type = 'button';
    const hint = element('p', 'field-help');
    function showHint() {
      const entry = product.value === '' ? null : catalog[Number(product.value)];
      const used = product.value === original ? item.used || 0 : 0;
      price.max = entry ? String(entry.regularPrice - 1) : '';
      hint.textContent = entry
        ? `등록 재고 ${entry.stock ?? '미설정'} · 행사 접수 ${used}개${quantity.value ? ` · 행사 잔여 ${Math.max(0, Number(quantity.value) - used)}개` : ''}`
        : (item.productId ? '판매 목록에서 이 상품을 찾을 수 없습니다. 상품을 다시 선택하거나 이 줄을 삭제해 주세요.' : '');
    }
    product.addEventListener('change', showHint);
    quantity.addEventListener('input', showHint);
    remove.addEventListener('click', () => {
      const next = row.nextElementSibling?.querySelector('select') || row.previousElementSibling?.querySelector('select');
      row.remove(); renderEmpty(); sync(); (next || add).focus();
    });
    row.append(title, labeled('상품 · 옵션', product), labeled('행사가 (원)', price), labeled('행사 수량 (개)', quantity), remove, hint);
    row.collect = () => {
      const entry = product.value === '' ? null : catalog[Number(product.value)];
      return { productId: entry?.productId, optionId: entry?.optionId, price: price.valueAsNumber, quantity: quantity.valueAsNumber };
    };
    list.append(row); showHint();
    return product;
  }

  function renderEmpty() {
    if (list.children.length) return;
    const empty = element('p', 'field-help', '아직 추가한 행사 품목이 없습니다.'); empty.dataset.bfEmpty = ''; list.append(empty);
  }

  function show({ config, catalog: entries, state }) {
    catalog = entries; revision = config.revision;
    enabled.checked = config.enabled; starts.value = kst(config.startsAt); ends.value = kst(config.endsAt);
    list.replaceChildren(); config.items.forEach(addRow); renderEmpty();
    status.textContent = `현재 상태: ${formatState[state]}`;
    ready = true;
  }

  async function load() {
    if (busy) return;
    busy = true; ready = false; sync(); status.textContent = '행사 설정을 불러오고 있습니다.';
    try { show(await fetchJson('/api/admin/black-friday')); }
    catch (error) { if (error.status === 401) onUnauthorized(); status.textContent = error.message; }
    finally { busy = false; sync(); }
  }

  add.addEventListener('click', () => { const select = addRow(); sync(); select.focus(); });
  reload.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !ready) return;
    if (enabled.checked && (!starts.value || !ends.value || !list.querySelector('fieldset'))) {
      status.textContent = '행사를 켜려면 시작·종료 일시와 품목을 입력해 주세요.';
      (!starts.value ? starts : !ends.value ? ends : add).focus();
      return;
    }
    const input = { revision, enabled: enabled.checked, startsAt: starts.value, endsAt: ends.value, items: [...list.querySelectorAll('fieldset')].map(row => row.collect()) };
    busy = true; sync(); status.textContent = '행사 설정을 저장하고 있습니다.';
    try {
      const { config, state } = await fetchJson('/api/admin/black-friday', { method: 'PUT', body: JSON.stringify(input) });
      revision = config.revision;
      status.textContent = `저장했습니다. 현재 상태: ${formatState[state]}`;
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      status.textContent = error.message;
    } finally { busy = false; sync(); }
  });
  return { load };
}
