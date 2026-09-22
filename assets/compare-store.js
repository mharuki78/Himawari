const KEY = 'himawari:compare:v1';
let selected;
let catalog = [];
let tray;
let feedback;

export function normalizeCompareIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 3);
}
export function getCompareIds() {
  if (selected) return [...selected];
  try { selected = normalizeCompareIds(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { selected = []; }
  return [...selected];
}
export function setCompareIds(ids) {
  selected = normalizeCompareIds(ids);
  try { localStorage.setItem(KEY, JSON.stringify(selected)); } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('himawari:compare-change', { detail: { ids: [...selected] } }));
  return [...selected];
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function ensureStyle() {
  if (document.querySelector('[data-compare-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/assets/compare-tools.css'; link.dataset.compareStyle = '';
  document.head.append(link);
}
function announce(message) {
  if (!feedback) {
    feedback = el('p', '', 'compare-feedback'); feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite'); document.body.append(feedback);
  }
  feedback.textContent = message;
  feedback.hidden = false;
  window.clearTimeout(announce.timer);
  announce.timer = window.setTimeout(() => { feedback.hidden = true; }, 4500);
}
function sync() {
  const ids = getCompareIds();
  document.querySelectorAll('[data-compare-add]').forEach(button => {
    const active = ids.includes(button.dataset.compareAdd);
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? '비교 선택됨' : '비교에 추가';
  });
  if (!tray) return;
  const picked = ids.map(id => catalog.find(p => p.id === id)).filter(Boolean);
  tray.hidden = !picked.length;
  document.body.classList.toggle('has-compare-tray', picked.length > 0);
  tray.replaceChildren();
  const heading = el('strong', `비교할 가방 ${picked.length}/3`);
  const list = el('ul');
  picked.forEach(p => {
    const item = el('li');
    const img = el('img'); img.src = p.image; img.alt = ''; img.width = 40; img.height = 40;
    img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    const remove = el('button', '삭제'); remove.type = 'button';
    remove.setAttribute('aria-label', `${p.model || p.name} 비교에서 삭제`);
    remove.addEventListener('click', () => {
      setCompareIds(getCompareIds().filter(id => id !== p.id));
      (tray.hidden ? document.querySelector(`[data-compare-add="${p.id}"]`) : tray.querySelector('a'))?.focus();
    });
    item.append(img, el('span', p.model || p.name), remove); list.append(item);
  });
  const link = el('a', '나란히 비교하기', 'compare-tray__go');
  link.href = `/compare.html?products=${encodeURIComponent(ids.join(','))}`;
  const clear = el('button', '전체 비우기', 'compare-tray__clear'); clear.type = 'button';
  clear.addEventListener('click', () => {
    const first = ids[0]; setCompareIds([]); document.querySelector(`[data-compare-add="${first}"]`)?.focus();
    announce('비교 목록을 비웠습니다.');
  });
  tray.append(heading, list, link, clear);
}
export function initCompareTray(products) {
  ensureStyle(); catalog = Array.isArray(products) ? products : [];
  if (!tray && !document.querySelector('.compare-page')) {
    tray = el('aside', '', 'compare-tray'); tray.setAttribute('aria-label', '선택한 가방 비교'); tray.hidden = true;
    const inline = document.querySelector('[data-detail-compare]');
    if (inline) inline.after(tray); else document.body.append(tray);
  }
  setCompareIds(getCompareIds().filter(id => catalog.some(p => p.id === id)));
  sync();
}
export function createCompareButton(product) {
  ensureStyle();
  const button = el('button', getCompareIds().includes(product.id) ? '비교 선택됨' : '비교에 추가', 'compare-add');
  button.type = 'button'; button.dataset.compareAdd = product.id;
  button.setAttribute('aria-label', `${product.name || product.model} 비교 선택`);
  button.setAttribute('aria-pressed', String(getCompareIds().includes(product.id)));
  button.addEventListener('click', () => {
    const ids = getCompareIds();
    if (ids.includes(product.id)) setCompareIds(ids.filter(id => id !== product.id));
    else if (ids.length < 3) {
      setCompareIds([...ids, product.id]);
      announce(`${product.model || '가방'}을 비교 목록에 추가했습니다.`);
      window.himawariTrack?.('Add to comparison', { productId: product.id });
    } else announce('가방은 최대 3개까지 비교할 수 있습니다. 아래 비교 목록에서 하나를 삭제해 주세요.');
  });
  return button;
}
if (typeof window !== 'undefined') {
  window.addEventListener('himawari:compare-change', sync);
  window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    selected = undefined;
    window.dispatchEvent(new CustomEvent('himawari:compare-change', { detail: { ids: getCompareIds() } }));
  });
}
