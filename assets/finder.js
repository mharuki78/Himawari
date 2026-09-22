import { fetchProducts, priceFormatter, safeHttpsUrl } from '../products.js';
import { SPEC_FIELDS } from './product-specs.js';
import { findMatchingProducts, PURPOSE_LABELS } from './finder-matching.js';
import { initCompareTray, createCompareButton } from './compare-store.js';

const form = document.querySelector('[data-finder-form]');
const results = document.querySelector('[data-finder-results]');
const cards = document.querySelector('[data-finder-cards]');
const compare = document.querySelector('[data-finder-compare]');
const status = document.querySelector('[data-finder-status]');
const summary = document.querySelector('[data-finder-summary]');
const recovery = document.querySelector('[data-finder-recovery]');
const submit = form?.querySelector('button[type="submit"]');
let revision = 0;
let started = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function trackStart() {
  if (started) return;
  started = true;
  window.himawariTrack?.('Finder started');
}

function card(item, rank) {
  const { product, reasons, check, variantCount } = item;
  const article = element('article', '', 'finder-card');
  const media = element('div', '', 'finder-card__media');
  const fallback = element('p', '제품 사진을 준비하고 있습니다.', 'finder-image-fallback');
  const imageUrl = safeHttpsUrl(product.image);
  if (imageUrl) {
    const image = element('img'); image.src = imageUrl; image.alt = product.name; image.loading = 'lazy'; image.decoding = 'async';
    fallback.hidden = true;
    image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }, { once: true });
    media.append(image);
  }
  media.append(fallback);
  const body = element('div', '', 'finder-card__body');
  body.append(element('h3', product.model || product.name), element('p', product.name, 'finder-card__name'), element('strong', priceFormatter.format(product.price), 'finder-card__price'));
  body.append(element('p', `조건에 맞는 판매 구성 ${variantCount}가지 · 표시 가격은 현재 구성 기준`, 'finder-card__variants'));
  const reasonList = element('ul', '', 'finder-card__reasons');
  reasons.forEach(reason => reasonList.append(element('li', reason)));
  body.append(reasonList, element('p', check, 'finder-card__check'));
  const link = element('a', '사진·옵션 확인하기');
  link.href = `product.html?id=${encodeURIComponent(product.id)}`;
  link.setAttribute('aria-label', `${product.name} 사진·옵션 확인하기`);
  link.addEventListener('click', () => window.himawariTrack?.('Finder result selected', { productId: product.id, rank }));
  body.append(link, createCompareButton(product));
  article.append(media, body);
  return article;
}

function renderCompare(items) {
  compare.replaceChildren();
  compare.hidden = items.length < 2;
  if (items.length < 2) return;
  const table = element('table');
  table.append(element('caption', '추천 제품의 등록 사양 비교'));
  const head = table.createTHead().insertRow();
  ['비교 기준', ...items.map(item => item.product.model)].forEach(label => { const th = element('th', label); th.scope = 'col'; head.append(th); });
  const body = table.createTBody();
  const fields = [['price', '현재 구성 가격'], ...SPEC_FIELDS.slice(0, 6)];
  fields.forEach(([key, label]) => {
    const row = body.insertRow(); const th = element('th', label); th.scope = 'row'; row.append(th);
    items.forEach(item => row.insertCell().textContent = key === 'price' ? priceFormatter.format(item.product.price) : item.product.specs?.[key] || '미확인 · 구매 전 문의');
  });
  compare.append(table);
}

function invalidate() {
  revision += 1;
  results.hidden = true;
  submit.disabled = false;
  form.removeAttribute('aria-busy');
  status.textContent = '조건을 바꾸셨습니다. 추천 결과를 다시 확인해 주세요.';
}

function addRecovery(label, action) {
  const button = element('button', label, 'finder-adjust'); button.type = 'button';
  button.addEventListener('click', action); recovery.append(button);
}

function setChoice(name, value) { form.elements[name].value = value; }

async function recommend(event) {
  event?.preventDefault();
  trackStart();
  const missing = [...form.querySelectorAll('[required]')].find(control => !control.validity.valid);
  if (missing) { status.textContent = '네 가지 질문에 모두 답해 주세요.'; missing.focus(); return; }
  const ticket = ++revision;
  const answers = Object.fromEntries(new FormData(form));
  results.hidden = true; submit.disabled = true; form.setAttribute('aria-busy', 'true');
  status.textContent = '예산·재고와 등록된 사양을 확인하고 있습니다.';
  try {
    const products = await fetchProducts();
    if (ticket !== revision) return;
    initCompareTray(products);
    const matching = findMatchingProducts(products, answers);
    cards.replaceChildren(...matching.items.map((item, index) => card(item, index + 1)));
    renderCompare(matching.items);
    const count = matching.items.length;
    const budgetLabel = Number(answers.budget) < 999999 ? `${priceFormatter.format(answers.budget)} 이하` : '예산 제한 없음';
    summary.textContent = count ? `${PURPOSE_LABELS[answers.purpose]} · ${budgetLabel} 조건에서 ${count}개 제품군을 찾았습니다.${count < 3 ? ' 등록된 사양으로 조건을 확인할 수 있는 제품만 보여드립니다.' : ''}` : '현재 예산·용도·사양 조건을 모두 확인할 수 있는 제품이 없습니다. 조건을 바꾸어 다시 찾아보세요.';
    recovery.replaceChildren();
    if (count < 3) {
      if (Number(answers.budget) < 999999 && matching.excluded.budget) addRecovery('예산 제한 없이 다시 찾기', () => { setChoice('budget', '999999'); recommend(); });
      if (answers.storage !== 'any' || answers.priority !== 'design') addRecovery('수납·우선조건 넓혀서 다시 찾기', () => { setChoice('storage', 'any'); setChoice('priority', 'design'); recommend(); });
      addRecovery('처음부터 다시 선택', () => { form.reset(); });
    }
    recovery.hidden = !recovery.childElementCount;
    results.hidden = false;
    status.textContent = count ? `${count}개 제품군의 추천 결과를 확인해 주세요.` : '조건에 맞는 추천 결과가 없습니다.';
    window.himawariTrack?.('Finder completed', { purpose: answers.purpose, storage: answers.storage, budget: Number(answers.budget), priority: answers.priority, resultCount: count });
    results.focus({ preventScroll: true });
    results.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch {
    if (ticket === revision) status.textContent = '제품 정보를 불러오지 못했습니다. 선택한 조건은 유지됩니다. 추천 결과 보기를 다시 눌러 주세요.';
  } finally {
    if (ticket === revision) { submit.disabled = false; form.removeAttribute('aria-busy'); }
  }
}

form?.addEventListener('submit', recommend);
form?.addEventListener('change', () => { trackStart(); invalidate(); });
form?.addEventListener('reset', () => {
  invalidate(); status.textContent = '조건을 초기화했습니다. 네 가지 질문을 다시 선택해 주세요.';
  form.querySelector('input').focus();
});
