import { fetchProducts, priceFormatter } from '../products.js';
import { PUBLIC_SPEC_FIELDS as SPEC_FIELDS } from './product-specs.js';
import { groupProductFamilies, productVariantLabel, productFamilyKey, productCategory } from './catalog-tools.js';
import { getCompareIds, setCompareIds, initCompareTray } from './compare-store.js';

const status = document.querySelector('[data-compare-status]');
const controls = document.querySelector('[data-compare-selects]');
const output = document.querySelector('[data-compare-output]');
let products = [];
let slots = ['', '', ''];
let activeSlot = 0;
let activeFamily = '';
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
    if (p) {
      const variants = products.filter(item => productFamilyKey(item) === productFamilyKey(p));
      if (variants.length > 1) {
        const label = text('label', '색상·크기·구성', 'compare-variant');
        const select = document.createElement('select'); select.setAttribute('aria-label', `비교 제품 ${i + 1} 색상·크기·구성`);
        variants.forEach(v => { const option = text('option', `${productVariantLabel(v)} · ${priceFormatter.format(v.price)}${v.soldOut ? ' · 품절' : ''}`); option.value = v.id; option.selected = v.id === p.id; option.disabled = slots.includes(v.id) && v.id !== p.id; select.append(option); });
        select.addEventListener('change', () => { slots[i] = select.value; render(); controls.querySelector(`[data-slot="${i}"]`)?.closest('.compare-slot')?.querySelector('select')?.focus({preventScroll:true}); });
        label.append(select); card.append(label);
      }
      const remove = text('button', '선택 해제'); remove.type = 'button'; remove.className = 'compare-remove'; remove.setAttribute('aria-label', `제품 ${i + 1} 선택 해제`); remove.onclick = () => { slots[i] = ''; render(); renderPicker(); controls.querySelector(`[data-slot="${i}"]`).focus(); }; card.append(remove);
    }
    controls.append(card);
  });
}
function closePicker() { panel.hidden = true; activeFamily = ''; document.querySelector('[data-picker-variants]').hidden = true; renderSlots(); controls.querySelector(`[data-slot="${activeSlot}"]`).focus({preventScroll:true}); }
function renderPicker() {
  activeFamily = ''; document.querySelector('[data-picker-variants]').hidden = true;
  const query = search.value.trim().toLocaleLowerCase('ko-KR');
  const matches = groupProductFamilies(products).filter(f => !query || f.searchText.includes(query));
  document.querySelector('[data-search-clear]').hidden = !search.value;
  document.querySelector('[data-picker-count]').textContent = matches.length ? `${matches.length}개 모델 · 모델을 고른 뒤 색상·크기·구성을 선택하세요.` : '검색 결과가 없습니다. 다른 제품명이나 모델 번호를 입력해 주세요.';
  picker.replaceChildren();
  matches.forEach(family => {
    const p = family.variants.find(v => !v.soldOut) || family.representative;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'picker-product';
    button.setAttribute('aria-label', `${p.model} 모델 옵션 ${family.variants.length}가지 보기`);
    button.setAttribute('aria-expanded', String(activeFamily === family.key));
    button.append(photo(p), text('strong', p.model || 'Himawari'), text('span', p.name), text('b', `${priceFormatter.format(family.minPrice)}부터`), text('em', `색상·크기·구성 ${family.variants.length}가지`));
    button.onclick = () => { activeFamily = family.key; showVariants(family); };
    picker.append(button);
  });
}
function showVariants(family) {
  const region = document.querySelector('[data-picker-variants]'); region.hidden = false; region.replaceChildren();
  const title = text('h3', `${family.representative.model} · 색상·크기·구성 선택`); title.tabIndex = -1; region.append(title);
  const grid = text('div', '', 'picker-variant-grid');
  family.variants.forEach(p => {
    const button = text('button', '', 'picker-product'); button.type = 'button'; button.disabled = slots.includes(p.id);
    button.append(photo(p), text('strong', productVariantLabel(p)), text('b', priceFormatter.format(p.price)), text('em', button.disabled ? '선택됨' : p.soldOut ? '품절 · 비교 가능' : '이 옵션 비교하기'));
    button.onclick = () => { slots[activeSlot] = p.id; panel.hidden = true; region.hidden = true; activeFamily = ''; render(); controls.querySelector(`[data-slot="${activeSlot}"]`).focus({preventScroll:true}); };
    grid.append(button);
  });
  region.append(grid); title.focus({preventScroll:true}); region.scrollIntoView({block:'nearest'});
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
  setCompareIds(selected.map(p => p.id));
  renderSuggestions(selected);
  const url = new URL(location.href); if (selected.length) url.searchParams.set('products', selected.map(p => p.id).join(',')); else url.searchParams.delete('products'); history.replaceState(null, '', url);
  output.replaceChildren();
  const difference = document.querySelector('[data-compare-differences]');
  difference.disabled = selected.length < 2;
  if (!selected.length) { status.textContent = '비교할 제품을 선택해 주세요.'; return; }
  const table = document.createElement('table'); const caption = table.createCaption(); caption.textContent = '선택한 제품의 실제 등록 정보 비교';
  const head = table.createTHead().insertRow();
  for (const text of ['비교 기준', ...selected.map(p => p.name)]) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; head.append(th); }
  const body = table.createTBody();
  const rows = [['가격', p => priceFormatter.format(p.price)], ['주문 상태', p => p.soldOut ? '품절' : '주문 가능'], ...SPEC_FIELDS.map(([key, label]) => [label, p => p.specs?.[key] || '미확인 · 구매 전 문의'])];
  let displayed = 0;
  for (const [label, read] of rows) {
    const values = selected.map(read);
    if (difference.checked && selected.length > 1 && new Set(values.map(String)).size === 1) continue;
    displayed++;
    const tr = body.insertRow(); const th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.append(th); for (const value of values) tr.insertCell().textContent = value;
  }
  const tr = body.insertRow(); const th = document.createElement('th'); th.scope = 'row'; th.textContent = '제품 확인'; tr.append(th);
  for (const p of selected) { const a = document.createElement('a'); a.href = `product.html?id=${encodeURIComponent(p.id)}`; a.textContent = '상세·옵션 보기 →'; tr.insertCell().append(a); }
  output.append(table); status.textContent = `${selected.length}개 제품을 비교합니다.${difference.checked && selected.length > 1 ? (displayed ? ` 다른 항목 ${displayed}개를 표시합니다.` : ' 등록된 비교 정보가 같습니다.') : ' 크기·색상별 값은 다를 수 있습니다.'}`;
  window.himawariTrack?.('Compare products', { itemCount: selected.length });
}
function renderSuggestions(selected) {
  const region = document.querySelector('[data-compare-suggestions]'); region.replaceChildren();
  if (!selected.length || selected.length === 3) { region.hidden = true; return; }
  const anchor = selected[0];
  const matches = groupProductFamilies(products.filter(p => !p.soldOut && Number(p.price) > 0
    && productCategory(p) === productCategory(anchor)
    && Math.abs(p.price - anchor.price) <= anchor.price * .3))
    .filter(f => !selected.some(p => productFamilyKey(p) === f.key)).slice(0, 3);
  region.hidden = !matches.length;
  if (!matches.length) return;
  region.append(text('h2', '비슷한 용도·가격으로 비교해 보세요'), text('p', '첫 번째 제품과 같은 용도이며, 가격 차이가 30% 이내인 판매 구성입니다.'));
  const list = text('div', '', 'compare-suggestions__list');
  matches.forEach(f => {
    const p = f.representative;
    const button = text('button', '', 'compare-suggestion'); button.type = 'button';
    button.append(photo(p), text('strong', p.model), text('span', productVariantLabel(p)), text('b', priceFormatter.format(p.price)), text('span', '비교에 추가'));
    button.addEventListener('click', () => { const slot = slots.indexOf(''); if (slot < 0) return; slots[slot] = p.id; render(); controls.querySelector(`[data-slot="${slot}"]`)?.focus({preventScroll:true}); });
    list.append(button);
  });
  region.append(list);
}
async function load() {
  const retry = document.querySelector('[data-compare-retry]'); retry.disabled = true; status.textContent = '제품 정보를 불러오는 중입니다.';
  try {
    products = await fetchProducts(); controls.replaceChildren();
    const query = new URL(location.href).searchParams;
    const requested = query.has('products') ? query.get('products').split(',') : getCompareIds();
    initCompareTray(products);
    slots = [...new Set(requested.filter(id => products.some(p => p.id === id)))].slice(0, 3);
    while (slots.length < 3) slots.push('');
    render();
  } catch { status.textContent = '제품을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  finally { retry.disabled = false; }
}
document.querySelector('[data-compare-retry]').addEventListener('click', load);
document.querySelector('[data-compare-differences]').addEventListener('change', render);
load();
