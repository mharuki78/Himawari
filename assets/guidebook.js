import { fetchProducts, priceFormatter, safeHttpsUrl } from '../products.js';
import { initCompareTray, createCompareButton } from './compare-store.js';
import { productsForGuideChapter, matchesGuideChapter } from './guidebook-tools.js';

const $ = (id) => document.getElementById(id);
const image = $('page-image');
let page = 1, count = 67, entries = [], sequence = 0;
let products = [], guide = null, catalogState = 'loading';
const productPanel = document.createElement('section');
productPanel.className = 'guide-products';
productPanel.setAttribute('aria-label', '현재 페이지의 제품');
productPanel.hidden = true;
document.querySelector('.reader-hint').after(productPanel);
const src = (p) => `/assets/guides/pages/${String(p).padStart(2, '0')}.webp`;
const currentChapter = () => [...entries].reverse().find(entry => entry.page <= page);

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderGuideProducts() {
  const chapter = currentChapter();
  productPanel.replaceChildren();
  productPanel.hidden = !chapter || !/No\./i.test(chapter.title);
  if (productPanel.hidden) return;
  productPanel.append(element('h2', '지금 보고 있는 가방'));
  if (catalogState !== 'ready') {
    const status = element('p', catalogState === 'loading' ? '현재 판매 제품을 확인하고 있습니다.' : '판매 제품을 불러오지 못했습니다. 가이드북은 계속 볼 수 있습니다.', 'guide-product-note');
    status.setAttribute('role', 'status');
    productPanel.append(status);
    if (catalogState === 'error') {
      const retry = element('button', '제품 다시 불러오기');
      retry.type = 'button'; retry.onclick = loadGuideProducts; productPanel.append(retry);
    }
    return;
  }
  const matched = productsForGuideChapter(products, chapter, guide);
  if (!matched.length) {
    productPanel.append(element('p', '이 페이지와 정확히 연결된 판매 제품이 아직 없습니다. 현재 판매하는 가방은 전체 제품에서 확인해 주세요.', 'guide-product-note'));
    const all = element('a', '전체 제품 보기'); all.href = '/products.html'; productPanel.append(all);
    return;
  }
  productPanel.append(element('p', '현재 판매 제품의 가격과 등록 사양입니다. 색상·구성을 선택해 상세 사진을 확인하거나 비교에 담아보세요.', 'guide-product-note'));
  const list = element('div', undefined, 'guide-product-list');
  for (const group of matched) {
    const row = element('article', undefined, 'guide-product');
    const copy = element('div', undefined, 'guide-product-copy');
    const photo = element('img', undefined, 'guide-product-photo'); photo.loading = 'lazy'; photo.decoding = 'async';
    const model = element('h3', group.model);
    const name = element('p', undefined, 'guide-product-name');
    const price = element('strong', undefined, 'guide-product-price');
    const specs = element('dl', undefined, 'guide-product-specs');
    const actions = element('div', undefined, 'guide-product-actions');
    const detail = element('a', '제품 상세 보기');
    const compareSlot = element('span', undefined, 'guide-compare-action');
    actions.append(detail, compareSlot);
    const variant = element('select');
    variant.id = `guide-variant-${group.model.replace(/[^a-z0-9]/gi, '')}`;
    const label = element('label', '색상·구성'); label.htmlFor = variant.id;
    for (const product of group.variants) {
      const option = element('option', `${product.name} · ${priceFormatter.format(product.price)}${product.soldOut ? ' · 품절' : ''}`);
      option.value = product.id; variant.append(option);
    }
    function selectProduct() {
      const product = group.variants.find(item => item.id === variant.value) || group.variants[0];
      const imageUrl = safeHttpsUrl(product.image);
      photo.hidden = !imageUrl; photo.alt = product.name; if (imageUrl) photo.src = imageUrl;
      photo.onerror = () => { photo.hidden = true; };
      name.textContent = product.name; price.textContent = `${priceFormatter.format(product.price)}${product.soldOut ? ' · 품절' : ''}`;
      specs.replaceChildren();
      for (const [key, title] of [['dimensions', '외부 크기'], ['weight', '무게'], ['laptopCompartment', '노트북 수납칸']]) {
        specs.append(element('dt', title), element('dd', product.specs?.[key] || '미확인 · 구매 전 문의'));
      }
      detail.href = `/product.html?id=${encodeURIComponent(product.id)}`;
      compareSlot.replaceChildren(createCompareButton(product));
    }
    variant.onchange = selectProduct;
    copy.append(model, name, price);
    if (group.variants.length > 1) copy.append(label, variant);
    copy.append(specs, actions); row.append(photo, copy); list.append(row); selectProduct();
  }
  productPanel.append(list);
}

async function loadGuideProducts() {
  catalogState = 'loading'; renderGuideProducts();
  try {
    const [catalog, response] = await Promise.all([fetchProducts(), fetch('/data/guidebook-specs-2026.json')]);
    if (!response.ok) throw new Error('guide mapping');
    guide = await response.json(); products = catalog;
    initCompareTray(products); catalogState = 'ready';
  } catch { catalogState = 'error'; }
  renderGuideProducts(); filterContents();
}

function filterContents() {
  const query = $('guide-search').value.trim();
  let shown = 0;
  document.querySelectorAll('#guide-toc a').forEach(link => {
    const entry = entries.find(item => item.page === Number(link.dataset.page));
    link.hidden = !matchesGuideChapter(entry, query, guide);
    if (!link.hidden) shown += 1;
  });
  $('guide-search-reset').hidden = !query;
  $('guide-search-status').textContent = query ? (shown ? `${shown}개 목차를 찾았습니다.` : '일치하는 목차가 없습니다. 모델 번호를 바꾸거나 검색을 지워주세요.') : '';
  if (query) {
    toggle.setAttribute('aria-expanded', 'true'); $('guide-toc').classList.add('open'); toggle.firstChild.textContent = '목차 접기 ';
  }
}
$('guide-search').addEventListener('input', event => { if (!event.isComposing) filterContents(); });
$('guide-search').addEventListener('compositionend', filterContents);
$('guide-search-form').onsubmit = event => { event.preventDefault(); $('guide-toc').querySelector('a:not([hidden])')?.click(); };
$('guide-search-form').onreset = () => { $('guide-search').value = ''; filterContents(); $('guide-search').focus(); };

function hashPage() { return Number(new URLSearchParams(location.hash.slice(1)).get('page')) || 1; }
async function go(value, animate = true) {
  const next = Math.min(count, Math.max(1, Math.trunc(Number(value)) || 1));
  const ticket = ++sequence;
  $('reader-status').textContent = '페이지를 불러오는 중입니다…';
  const ready = new Image(); ready.src = src(next);
  try { await ready.decode(); } catch {
    if (ticket === sequence) $('reader-status').textContent = '페이지를 불러오지 못했습니다. 다시 이동하거나 원본 PDF를 열어주세요.';
    return;
  }
  if (ticket !== sequence) return;
  document.querySelectorAll('.turn-sheet').forEach(el => el.remove());
  if (animate && next !== page && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const sheet = image.cloneNode(); sheet.removeAttribute('id'); sheet.alt = ''; sheet.setAttribute('aria-hidden', 'true'); sheet.className = 'turn-sheet';
    $('book').append(sheet);
    sheet.style.transformOrigin = next > page ? 'left center' : 'right center';
    sheet.animate([{transform:'rotateY(0deg)',opacity:1},{transform:`rotateY(${next > page ? -90 : 90}deg)`,opacity:.1}],{duration:360,easing:'cubic-bezier(.22,.7,.2,1)'}).finished.finally(() => sheet.remove());
  }
  page = next;
  const chapter = currentChapter();
  image.src = ready.src; image.alt = `${chapter?.title || '가이드북'} · ${page}페이지`;
  $('chapter').textContent = chapter?.title || '2026 COLLECTION';
  $('page-number').value = page;
  $('previous').disabled = page === 1; $('next').disabled = page === count;
  $('reader-status').textContent = `${page} / ${count} 페이지`;
  document.querySelectorAll('#guide-toc a').forEach(link => {
    if (Number(link.dataset.page) === chapter?.page) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  history.replaceState(null,'',`#page=${page}`);
  renderGuideProducts();
  for (const neighbor of [page-1,page+1]) if (neighbor > 0 && neighbor <= count) { const preload = new Image(); preload.src = src(neighbor); }
}
$('previous').onclick = () => go(page-1);
$('next').onclick = () => go(page+1);
$('page-form').onsubmit = event => { event.preventDefault(); go($('page-number').value); };
document.addEventListener('keydown', event => {
  if ($('zoom-dialog').open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(page + (event.key === 'ArrowRight' ? 1 : -1)); }
});
let start;
$('stage').addEventListener('pointerdown', event => { if (event.isPrimary) start = {x:event.clientX,y:event.clientY,id:event.pointerId}; });
$('stage').addEventListener('pointerup', event => {
  if (!start || start.id !== event.pointerId) return;
  const dx = event.clientX-start.x, dy = event.clientY-start.y; start = null;
  if (Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.5) go(page+(dx<0?1:-1));
});
$('stage').addEventListener('pointercancel', () => { start = null; });
image.draggable = false;
const toggle = document.querySelector('.toc-toggle');
toggle.onclick = () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded',String(open)); $('guide-toc').classList.toggle('open',open); toggle.firstChild.textContent = open ? '목차 접기 ' : '목차 펼치기 '; };
$('zoom').onclick = () => { $('zoom-image').src = src(page); $('zoom-image').alt = image.alt; $('zoom-dialog').showModal(); };
$('zoom-close').onclick = () => $('zoom-dialog').close();
window.addEventListener('hashchange', () => go(hashPage()));
try {
  const response = await fetch('/assets/guides/contents.json');
  if (!response.ok) throw new Error('contents');
  const data = await response.json(); count = data.count; entries = data.contents;
  $('page-number').max = count; $('page-total').textContent = `/ ${count}`;
  for (const entry of entries) {
    const link = document.createElement('a'); link.href = `#page=${entry.page}`; link.dataset.page = entry.page;
    const name = document.createElement('span'); name.textContent = entry.title;
    const number = document.createElement('small'); number.textContent = String(entry.page).padStart(2,'0'); link.append(name,number);
    link.onclick = event => { event.preventDefault(); go(entry.page); };
    $('guide-toc').append(link);
  }
  go(hashPage(),false);
} catch { $('reader-status').textContent = '목차를 불러오지 못했습니다. 페이지 번호나 이전·다음 버튼을 이용해주세요.'; }
loadGuideProducts();
