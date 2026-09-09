import { fetchProducts, priceFormatter } from '../products.js';
import { SPEC_FIELDS } from './product-specs.js';

const status = document.querySelector('[data-compare-status]');
const controls = document.querySelector('[data-compare-selects]');
const output = document.querySelector('[data-compare-output]');
let products = [];
function render() {
  const ids = [...controls.querySelectorAll('select')].map(e => e.value).filter(Boolean);
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
    for (let i = 0; i < 3; i++) {
      const label = document.createElement('label'); label.textContent = `제품 ${i + 1}`;
      const select = document.createElement('select'); select.setAttribute('aria-label', `비교 제품 ${i + 1}`);
      select.append(new Option('제품 선택', '')); for (const p of products) select.append(new Option(p.name, p.id));
      select.value = requested[i] || ''; select.addEventListener('change', render); label.append(select); controls.append(label);
    }
    render();
  } catch { status.textContent = '제품을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  finally { retry.disabled = false; }
}
document.querySelector('[data-compare-retry]').addEventListener('click', load);
load();
