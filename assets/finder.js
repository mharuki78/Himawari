import { fetchProducts, priceFormatter, safeHttpsUrl } from '../products.js';
import { SPEC_FIELDS } from './product-specs.js';
import { findMatchingProducts } from './finder-matching.js';
import { initCompareTray, createCompareButton } from './compare-store.js';
import { animate } from './site-ui.js';

const steps = [
  {
    id: 'intent', label: '구매 목적', title: '누구를 위한 가방인가요?',
    help: '직접 쓸 가방인지, 선물할 가방인지 골라주세요.',
    icon: 'M13 28h38v24H13zM10 22h44v8H10zM32 22v30M32 22c-12 0-17-3-15-9 2-5 11-4 15 9Zm0 0c12 0 17-3 15-9-2-5-11-4-15 9Z',
    options: [['personal', '개인 사용', '내가 직접 쓸 가방'], ['gift', '선물용', '누군가에게 선물할 가방']],
  },
  {
    id: 'use', label: '용도', title: '어디에 들고 다닐 건가요?',
    help: '가장 자주 쓸 용도를 골라주세요.',
    icon: 'M17 49a16 16 0 0 1 0-32h26a8 8 0 1 1 0 16H25a8 8 0 1 0 0 16h23M41 42l7 7-7 7M13 12v10m-5-5h10',
    options: [['daily', '데일리', '가벼운 외출과 일상'], ['travel', '여행', '여행이나 장거리 이동'], ['commute', '출퇴근', '업무와 통근'], ['laptop', '노트북', '수납칸 치수가 확인된 가방']],
  },
  {
    id: 'size', label: '크기', title: '어느 정도 크기가 좋으세요?',
    help: '가방 바깥 치수 중 가장 긴 변을 기준으로 나눴어요.',
    icon: 'M9 39 39 9l16 16-30 30zM16 32l6 6m1-13 4 4m3-11 6 6m1-13 4 4M23 50l6-6',
    options: [['small', '작게', '36cm 미만'], ['medium', '중간 크기', '36cm 이상 43cm 미만'], ['large', '넉넉하게', '43cm 이상'], ['any', '상관없어요']],
  },
  {
    id: 'budget', label: '예산', title: '예산은 얼마쯤 생각하세요?',
    help: '가방 한 개의 현재 판매가를 기준으로 찾습니다.',
    icon: 'M10 17h28l16 16-21 21L10 31zM23 25h.1M28 44l16-16m-18 6h.1m13 4h.1',
    options: [['under-30000', '3만원 미만'], ['30000-50000', '3만~5만원 미만'], ['50000-80000', '5만~8만원 미만'], ['80000-100000', '8만~10만원 미만'], ['100000-plus', '10만원 이상'], ['any', '상관없어요']],
  },
  {
    id: 'priority', label: '중요 기준', title: '무엇을 가장 중요하게 보세요?',
    help: '한 가지만 골라주세요. 확인 가능한 상품 정보를 먼저 보여드려요.',
    icon: 'M32 9l6 17 17 6-17 6-6 17-6-17-17-6 17-6zM49 11v12m-6-6h12',
    options: [['design', '디자인'], ['material', '소재'], ['storage', '수납'], ['durability', '내구성'], ['capacity', '용량'], ['weight', '무게'], ['waterproof', '방수']],
  },
  {
    id: 'color', label: '색상', title: '어떤 색을 좋아하세요?',
    help: '고른 계열의 색상으로 지금 주문할 수 있는 가방을 찾아요.',
    icon: 'M31 11c-12 0-22 9-22 21s10 21 22 21c6 0 8-4 6-8-1-3 1-6 5-6h5c5 0 8-3 8-8 0-12-11-20-24-20ZM18 31h.1m6-10h.1m11-1h.1m10 6h.1',
    options: [
      ['black', '블랙', '', '#292a2c'], ['gray', '그레이', '', '#9c9b9a'], ['light', '화이트·베이지', '', '#e8d8bc'],
      ['brown', '브라운', '', '#8b654f'], ['blue', '네이비·블루', '', '#5a78ad'], ['green', '카키·그린', '', '#758360'],
      ['pink', '핑크·코랄', '', '#e2a2aa'], ['purple', '퍼플·라벤더', '', '#ac9ac8'], ['warm', '레드·옐로 계열', '', '#d98662'],
      ['silver', '실버', '', '#c4c7cc'], ['any', '상관없어요'],
    ],
  },
];

const form = document.querySelector('[data-finder-form]');
const results = document.querySelector('[data-finder-results]');
const cards = document.querySelector('[data-finder-cards]');
const compare = document.querySelector('[data-finder-compare]');
const status = document.querySelector('[data-finder-status]');
const summary = document.querySelector('[data-finder-summary]');
const recovery = document.querySelector('[data-finder-recovery]');
const route = form.querySelector('[data-finder-route]');
const board = form.querySelector('[data-finder-board]');
const question = form.querySelector('[data-finder-question]');
const heading = form.querySelector('[data-finder-heading]');
const help = form.querySelector('[data-finder-help]');
const options = form.querySelector('[data-finder-options]');
const count = form.querySelector('[data-finder-count]');
const artIcon = form.querySelector('[data-finder-art-icon]');
const artName = form.querySelector('[data-finder-art-name]');
const artNumber = form.querySelector('[data-finder-art-number]');
const back = form.querySelector('[data-finder-back]');
const submit = form.querySelector('button[type="submit"]');
const submitLabel = form.querySelector('[data-finder-forward-label]');
const refresh = form.querySelector('[data-finder-refresh]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let answers = {};
let current = 0;
let furthest = 0;
let revision = 0;
let started = false;
let editing = false;
let animations = [];

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

function stopMotion() {
  for (const animation of animations) animation.revert();
  animations = [];
}

function animateStep(direction) {
  if (reduceMotion.matches) return;
  animations = [
    animate(question, { opacity: [0.55, 1], translateX: [14 * direction, 0], duration: 230, ease: 'outQuad' }),
    animate(artIcon.firstElementChild, { opacity: [0.35, 1], scale: [0.88, 1], duration: 270, ease: 'outQuad' }),
    animate(routeButtons[current].firstElementChild, { scale: [0.88, 1], duration: 240, ease: 'outQuad' }),
  ];
}

function buildOption(step, [value, title, note, shade]) {
  const label = element('label', '', 'finder-option');
  const input = element('input');
  input.type = 'radio';
  input.name = step.id;
  input.value = value;
  input.checked = answers[step.id] === value;
  const surface = element('span', '', 'finder-option__surface');
  const copy = element('span', '', 'finder-option__copy');
  copy.append(element('span', title, 'finder-option__title'));
  if (note) copy.append(element('span', note, 'finder-option__note'));
  if (shade) {
    const swatch = element('span', '', 'finder-swatch');
    swatch.style.setProperty('--swatch', shade);
    swatch.setAttribute('aria-hidden', 'true');
    surface.append(swatch);
  }
  const check = element('span', '', 'finder-option__check');
  check.setAttribute('aria-hidden', 'true');
  surface.append(copy, check);
  label.append(input, surface);
  return label;
}

const routeButtons = steps.map((step, index) => {
  const item = element('li');
  const button = element('button', '', 'finder-route__step');
  button.type = 'button';
  button.setAttribute('aria-label', (index + 1) + '단계 ' + step.label);
  button.append(element('span', String(index + 1), 'finder-route__number'), element('span', step.label, 'finder-route__name'));
  button.addEventListener('click', () => showStep(index));
  item.append(button);
  if (index < steps.length - 1) {
    const arrow = element('span', '→', 'finder-route__arrow');
    arrow.setAttribute('aria-hidden', 'true');
    item.append(arrow);
  }
  route.append(item);
  return button;
});

function updateRoute() {
  routeButtons.forEach((button, index) => {
    button.disabled = index > furthest;
    button.dataset.answered = String(Boolean(answers[steps[index].id]));
    if (index === current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function setLoading(loading) {
  submit.disabled = loading;
  refresh.disabled = loading;
  if (loading) form.setAttribute('aria-busy', 'true');
  else form.removeAttribute('aria-busy');
}

function showStep(index, { focus = true } = {}) {
  const direction = index < current ? -1 : 1;
  stopMotion();
  revision++;
  setLoading(false);
  current = index;
  const step = steps[index];
  form.hidden = false;
  status.textContent = '';
  board.dataset.step = step.id;
  count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(steps.length).padStart(2, '0');
  heading.textContent = step.title;
  help.textContent = step.help;
  artName.textContent = step.label;
  artNumber.textContent = String(index + 1).padStart(2, '0');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', step.icon);
  artIcon.replaceChildren(path);
  options.replaceChildren(...step.options.map(option => buildOption(step, option)));
  updateRoute();
  back.disabled = index === 0;
  submitLabel.textContent = index === steps.length - 1 ? '추천 가방 보기' : '다음';
  refresh.hidden = !editing || index === steps.length - 1;
  if (focus) {
    heading.focus({ preventScroll: true });
    const { top, bottom } = heading.getBoundingClientRect();
    if (top < 104 || bottom > innerHeight) form.scrollIntoView({ block: 'start', behavior: 'instant' });
    animateStep(direction);
  }
  results.hidden = true;
}

function showResults(matches, selection) {
  const count = matches.items.length;
  cards.replaceChildren(...matches.items.map((item, index) => card(item, index + 1)));
  renderCompare(matches.items);
  summary.textContent = count
    ? '고른 조건에 맞는 가방 ' + count + '종을 추천해요. 사진과 사양을 비교해 보세요.'
    : '고른 조건에 맞는 가방이 없어요. 아래에서 조건을 바꿔 다시 찾아보세요.';
  recovery.replaceChildren();
  steps.forEach((step, index) => {
    const [, label] = step.options.find(([value]) => value === selection[step.id]);
    const edit = element('button', step.label + ' · ' + label, 'finder-adjust');
    edit.type = 'button';
    edit.setAttribute('aria-label', step.label + ' 바꾸기, 현재 ' + label);
    edit.addEventListener('click', () => { editing = true; showStep(index); });
    recovery.append(edit);
  });
  stopMotion();
  results.hidden = false;
  results.querySelector('h2').focus({ preventScroll: true });
  form.hidden = true;
  results.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  window.himawariTrack?.('Finder completed', { ...selection, resultCount: count });
}

async function recommend() {
  const unanswered = steps.findIndex(step => !answers[step.id]);
  if (unanswered !== -1) {
    showStep(unanswered);
    status.textContent = '한 가지를 골라주세요.';
    options.querySelector('input').focus();
    return;
  }
  const ticket = ++revision;
  const selection = { ...answers };
  setLoading(true);
  status.textContent = '현재 가격과 재고를 확인하고 있어요.';
  try {
    const products = await fetchProducts();
    if (ticket !== revision) return;
    initCompareTray(products);
    showResults(findMatchingProducts(products, selection), selection);
  } catch {
    if (ticket === revision) status.textContent = '상품 정보를 불러오지 못했어요. 선택한 조건은 그대로예요. 다시 눌러 주세요.';
  } finally {
    if (ticket === revision) setLoading(false);
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const step = steps[current];
  if (!answers[step.id]) {
    status.textContent = '한 가지를 골라주세요.';
    options.querySelector('input').focus();
    return;
  }
  if (current === steps.length - 1) {
    void recommend();
    return;
  }
  furthest = Math.max(furthest, current + 1);
  showStep(current + 1);
});
form.addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('input[type="radio"]')) return;
  answers[input.name] = input.value;
  trackStart();
  revision++;
  setLoading(false);
  status.textContent = '';
  updateRoute();
});
form.addEventListener('reset', event => {
  event.preventDefault();
  answers = {};
  furthest = 0;
  editing = false;
  showStep(0);
});
back.addEventListener('click', () => showStep(current - 1));
refresh.addEventListener('click', () => void recommend());
reduceMotion.addEventListener('change', stopMotion);
addEventListener('pagehide', stopMotion);
showStep(0, { focus: false });
