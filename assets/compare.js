import { fetchProducts, priceFormatter } from '../products.js';
import { PUBLIC_SPEC_FIELDS as SPEC_FIELDS } from './product-specs.js';

const status = document.querySelector('[data-compare-status]');
const controls = document.querySelector('[data-compare-selects]');
const output = document.querySelector('[data-compare-output]');
let products = [];
let slots = ['', '', ''];
let activeSlot = 0;
const picker = document.querySelector('[data-picker-grid]');
const panel = document.querySelector('.compare-picker');
const search = document.querySelector('#product-search');
function photo(p) {
  const wrap = document.createElement('span'); wrap.className = 'compare-photo';
  const img = document.createElement('img'); img.alt = p.name; img.loading = 'lazy';
  try { const url = new URL(p.image, location.href); if (['https:', 'http:'].includes(url.protocol)) img.src = url.href; } catch {}
  const fallback = document.createElement('span'); fallback.textContent = '사진 준비 중'; fallback.hidden = true;
  img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
  if (!img.getAttribute('src')) { img.hidden = true; fallback.hidden = false; }
  wrap.append(img, fallback); return wrap;
}
function text(tag, value) { const el = document.createElement(tag); el.textContent = value; return el; }
function renderSlots() {
  controls.replaceChildren();
  slots.forEach((id, i) => {
    const p = products.find(p => p.id === id);
    const card = document.createElement('div'); card.className = 'compare-slot';
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'compare-choice'; button.dataset.slot = i;
    button.setAttribute('aria-controls', 'compare-picker');
    button.setAttribute('aria-expanded', String(!panel.hidden && activeSlot === i));
    button.setAttribute('aria-label', `제품 ${i + 1} ${p ? p.name + ' 변경' : '사진으로 선택'}`);
    button.append(text('small', `비교 제품 ${i + 1}`));
    if (p) { button.append(photo(p), text('strong', p.model || 'Himawari'), text('span', p.name), text('b', priceFormatter.format(p.price)), text('em', '다른 가방 선택 ↗')); }
    else { const empty = text('span', '+'); empty.className = 'compare-photo compare-empty'; button.append(empty, text('strong', '가방 추가'), text('span', '사진을 보고 선택하세요')); }
    button.addEventListener('click', () => { activeSlot = i; panel.hidden = false; renderSlots(); renderPicker(); search.focus({preventScroll:true}); panel.scrollIntoView({block:'nearest'}); });
    card.append(button);
    if (p) { const remove = text('button', '선택 해제'); remove.type = 'button'; remove.className = 'compare-remove'; remove.setAttribute('aria-label', `제품 ${i + 1} 선택 해제`); remove.onclick = () => { slots[i] = ''; render(); renderPicker(); controls.querySelector(`[data-slot="${i}"]`).focus(); }; card.append(remove); }
    controls.append(card);
  });
}
function closePicker() { panel.hidden = true; renderSlots(); controls.querySelector(`[data-slot="${activeSlot}"]`).focus({preventScroll:true}); }
function renderPicker() {
  const query = search.value.trim().toLocaleLowerCase('ko-KR');
  const matches = products.filter(p => `${p.name} ${p.model || ''}`.toLocaleLowerCase('ko-KR').includes(query));
  document.querySelector('[data-search-clear]').hidden = !search.value;
  document.querySelector('[data-picker-count]').textContent = matches.length ? `${matches.length}개 제품 · 비교 제품 ${activeSlot + 1}에 넣을 가방을 선택하세요.` : '검색 결과가 없습니다. 다른 제품명이나 모델 번호를 입력해 주세요.';
  picker.replaceChildren();
  matches.forEach(p => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'picker-product';
    const chosen = slots.includes(p.id); button.disabled = chosen; button.setAttribute('aria-label', `${p.name} ${chosen ? '선택됨' : '선택'}`);
    button.append(photo(p), text('strong', p.model || 'Himawari'), text('span', p.name), text('b', priceFormatter.format(p.price)), text('em', chosen ? '✓ 선택됨' : p.soldOut ? '품절 · 비교에 추가' : '비교에 추가 +'));
    button.onclick = () => { slots[activeSlot] = p.id; panel.hidden = true; render(); controls.querySelector(`[data-slot="${activeSlot}"]`).focus({preventScroll:true}); }; picker.append(button);
  });
}
search.addEventListener('input', e => { if (!e.isComposing) renderPicker(); });
search.addEventListener('compositionend', renderPicker);
document.querySelector('[data-search-clear]').onclick = () => { search.value = ''; renderPicker(); search.focus(); };
document.querySelector('[data-picker-close]').onclick = closePicker;
panel.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
function render() {
  renderSlots();
  const ids = slots.filter(Boolean);
  const selected = [...new Set(ids)].map(id => products.find(p => p.id === id)).filter(Boolean);
  const url = new URL(location.href); if (selected.length) url.searchParams.set('products', selected.map(p => p.id).join(',')); else url.searchParams.delete('products'); history.replaceState(null, '', url);
  output.replaceChildren();
  if (!selected.length) { status.textContent = '비교할 제품을 선택해 주세요.'; return; }
  const table = document.createElement('table'); const caption = table.createCaption(); caption.textContent = '선택한 제품의 실제 등록 정보 비교';
  const head = table.createTHead().insertRow();
  for (const text of ['비교 기준', ...selected.map(p => p.name)]) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; head.append(th); }
  const body = table.createTBody();
  const rows = [['가격', p => priceFormatter.format(p.price)], ['주문 상태', p => p.soldOut ? '품절' : '주문 가능'], ...SPEC_FIELDS.map(([key, label]) => [label, p => p.specs?.[key] || '미확인 · 구매 전 문의'])];
  for (const [label, read] of rows) { const tr = body.insertRow(); const th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.append(th); for (const p of selected) tr.insertCell().textContent = read(p); }
  const tr = body.insertRow(); const th = document.createElement('th'); th.scope = 'row'; th.textContent = '제품 확인'; tr.append(th);
  for (const p of selected) { const a = document.createElement('a'); a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.textContent = '상세·옵션 보기 →'; tr.insertCell().append(a); }
  output.append(table); status.textContent = `${selected.length}개 제품을 비교합니다. 크기·색상별 값은 다를 수 있습니다.`;
  window.himawariTrack?.('Compare products', { itemCount: selected.length });
}
async function load() {
  const retry = document.querySelector('[data-compare-retry]'); retry.disabled = true; status.textContent = '제품 정보를 불러오는 중입니다.';
  try {
    products = await fetchProducts(); controls.replaceChildren();
    const requested = (new URL(location.href).searchParams.get('products') || '').split(',');
    if (!requested[0]) requested[0] = products.find(p => p.model === 'No.1884')?.id || products[0]?.id;
    slots = [...new Set(requested.filter(id => products.some(p => p.id === id)))].slice(0, 3);
    while (slots.length < 3) slots.push('');
    render();
  } catch { status.textContent = '제품을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  finally { retry.disabled = false; }
}
document.querySelector('[data-compare-retry]').addEventListener('click', load);
load();
