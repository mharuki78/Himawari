import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { CATALOG_CATEGORIES, filterAndSortFamilies, groupProductFamilies } from '../assets/catalog-tools.js';
import { purchaseQuantity } from '../assets/purchase-quantity.js';

// A small DOM fixture runs the production event handlers without an order endpoint.
class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.value = '';
    this.hidden = false;
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  append(...nodes) { this.children.push(...nodes.flatMap(node => node?.tagName === 'fragment' ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  dispatch(name, values = {}) { return this.listeners[name]?.({ target: this, preventDefault() {}, ...values }); }
  focus() { this.focused = true; }
  closest() { return this; }
  querySelector() { return null; }
  querySelectorAll(selector) { return selector === '[data-category]' ? this.children : []; }
}

function environment(href) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const location = {};
  const navigate = value => {
    const url = new URL(value);
    Object.assign(location, { href: url.href, search: url.search, pathname: url.pathname });
  };
  navigate(href);
  const document = {
    body: { dataset: {} },
    querySelector: node,
    querySelectorAll: () => [],
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    addEventListener() {},
  };
  const window = { scrollX: 0, scrollY: 0, scrollTo() {}, addEventListener() {} };
  const storage = { getItem: () => null, setItem() {} };
  return { node, document, window, location, history: { replaceState: (_state, _title, url) => navigate(url) }, localStorage: storage, sessionStorage: storage };
}

async function catalogFixture(href) {
  const env = environment(href);
  env.node('[data-catalog-controls]').querySelector = env.node;
  const search = env.node('[data-catalog-search]');
  const sort = env.node('[data-catalog-sort]');
  const refinements = env.node('[data-catalog-refinements]');
  const refinementToggle = new Element('summary');
  const reset = new Element('button');
  refinements.querySelector = selector => selector === 'summary' ? refinementToggle : null;
  refinements.contains = element => element === refinementToggle || element === sort || element === reset || env.node('[data-catalog-categories]').children.includes(element);
  refinementToggle.focus = options => { refinementToggle.openDuringFocus = refinements.open; refinementToggle.focusOptions = options; refinementToggle.focusCalls = (refinementToggle.focusCalls || 0) + 1; env.document.activeElement = refinementToggle; };
  const labels = { featured: '추천순', 'price-low': '낮은 가격순', 'price-high': '높은 가격순', name: '이름순' };
  Object.defineProperty(sort, 'selectedOptions', { get: () => [{ textContent: labels[sort.value] }] });
  const media = { matches: true, addEventListener(_event, handler) { this.change = handler; } };
  const list = Object.assign(new Element(), { scrollLeft: 0, clientWidth: 350 });
  env.window.innerHeight = 844;
  env.window.scrollTo = ({ left, top }) => { env.window.scrollX = left; env.window.scrollY = top; };
  let timer;
  const context = vm.createContext({
    ...env, URL, URLSearchParams, CATALOG_CATEGORIES, filterAndSortFamilies,
    matchMedia: () => media,
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => { timer = callback; return 1; },
    clearTimeout: () => { timer = null; },
    createProductCard: product => {
      const article = Object.assign(new Element('article'), { product });
      const link = new Element('a');
      Object.defineProperty(link, 'offsetLeft', { get: () => list.children.indexOf(article) * 300 });
      link.offsetWidth = 300;
      link.offsetTop = 300;
      link.offsetHeight = 80;
      link.scrollIntoView = options => {
        link.scrollOptions = options;
        if (link.offsetLeft < list.scrollLeft) list.scrollLeft = link.offsetLeft;
        else if (link.offsetLeft + link.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = link.offsetLeft + link.offsetWidth - list.clientWidth;
        if (link.offsetTop < env.window.scrollY) env.window.scrollY = link.offsetTop;
        else if (link.offsetTop + link.offsetHeight > env.window.scrollY + env.window.innerHeight) env.window.scrollY = link.offsetTop + link.offsetHeight - env.window.innerHeight;
      };
      article.querySelector = selector => selector === 'a' ? link : null;
      return article;
    },
  });
  const source = await readFile(new URL('../products.js', import.meta.url), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function setupCatalog('), source.lastIndexOf('\nif (productLists.length')) + '\nglobalThis.setup = setupCatalog;', context);
  const products = Array.from({ length: 24 }, (_, index) => ({ id: `bag-${index}`, model: `No.${2000 + index}`, name: `가방 No.${2000 + index}`, description: index % 2 ? '학생 책가방' : '출근 노트북', price: 10000 + index * 1000 }));
  context.setup(list, groupProductFamilies(products));
  return { ...env, list, search, sort, media, refinementToggle, reset, flushInput: () => { const callback = timer; timer = null; callback?.(); } };
}

test('collapsed catalog controls retain URL filters and sort; reset clears pending search and restores pagination', async () => {
  const page = await catalogFixture('https://himawari.co.kr/products.html?q=노트북&category=business&sort=price-high');
  assert.equal(page.node('[data-catalog-refinements]').open, false);
  assert.equal(page.list.children.length, 12);
  assert.match(page.node('[data-catalog-refinement-summary]').textContent, /출근·노트북 · 높은 가격순/);
  assert.equal(page.list.children[0].product.id, 'bag-22');
  const school = page.node('[data-catalog-categories]').children.find(button => button.dataset.category === 'school');
  page.node('[data-catalog-categories]').dispatch('click', { target: school });
  assert.equal(page.list.children.length, 0);
  assert.equal(page.node('[data-catalog-empty]').hidden, false);
  assert.equal(new URL(page.location.href).searchParams.get('category'), 'school');
  page.search.value = '';
  page.search.dispatch('compositionend');
  page.sort.value = 'price-low';
  page.sort.dispatch('change');
  assert.equal(page.list.children[0].product.id, 'bag-1');
  page.search.value = 'pending query';
  page.search.dispatch('input');
  page.node('[data-catalog-controls]').dispatch('reset');
  page.flushInput();
  assert.equal(page.search.value, '');
  assert.equal(page.sort.value, 'featured');
  assert.equal(page.location.search, '');
  assert.equal(page.list.children.length, 12);
  page.node('[data-catalog-more]').dispatch('click');
  assert.equal(page.list.children.length, 24);
  assert.equal(page.node('[data-catalog-more]').hidden, true);
  page.media.matches = false;
  page.media.change();
  assert.equal(page.node('[data-catalog-refinements]').open, true);
});

test('catalog load-more reveals the focused new link in both the horizontal rail and document viewport', async () => {
  const page = await catalogFixture('https://himawari.co.kr/products.html');
  page.window.scrollY = 640;
  page.list.scrollLeft = 120;
  page.node('[data-catalog-more]').dispatch('click');
  const firstNewLink = page.list.children[12].querySelector('a');
  assert.equal(firstNewLink.focused, true);
  assert.ok(firstNewLink.offsetLeft >= page.list.scrollLeft);
  assert.ok(firstNewLink.offsetLeft + firstNewLink.offsetWidth <= page.list.scrollLeft + page.list.clientWidth, 'The focused appended item must be inside the scroller viewport');
  assert.equal(firstNewLink.scrollOptions.block, 'nearest');
  assert.equal(firstNewLink.scrollOptions.inline, 'nearest');
  assert.ok(firstNewLink.offsetTop - page.window.scrollY >= 0, 'The focused target must not remain above the viewport after the reveal');
  assert.ok(firstNewLink.offsetTop + firstNewLink.offsetHeight - page.window.scrollY <= page.window.innerHeight);
  page.list.scrollLeft = 300;
  page.sort.value = 'price-low';
  page.sort.dispatch('change');
  assert.equal(page.list.scrollLeft, 0, 'New criteria start the horizontal rail at its first result');
  page.list.scrollLeft = 600;
  page.node('[data-catalog-controls]').dispatch('reset');
  assert.equal(page.list.scrollLeft, 0, 'Reset starts the horizontal rail at its first result');
});

test('collapsing catalog refinements at the mobile breakpoint moves internal focus to the summary only', async () => {
  const page = await catalogFixture('https://himawari.co.kr/products.html');
  const disclosure = page.node('[data-catalog-refinements]');
  const category = page.node('[data-catalog-categories]').children[1];
  for (const control of [page.sort, page.reset, category]) {
    page.media.matches = false;
    page.media.change();
    page.document.activeElement = control;
    page.media.matches = true;
    page.media.change();
    assert.equal(page.document.activeElement, page.refinementToggle);
    assert.equal(page.refinementToggle.openDuringFocus, true, 'Focus moves before the details closes');
    assert.equal(disclosure.open, false);
  }
  assert.equal(page.refinementToggle.focusCalls, 3);
  assert.equal(page.refinementToggle.focusOptions.preventScroll, true);
  for (const control of [page.search, page.refinementToggle]) {
    page.media.matches = false;
    page.media.change();
    page.document.activeElement = control;
    page.media.matches = true;
    page.media.change();
    assert.equal(page.document.activeElement, control);
  }
  assert.equal(page.refinementToggle.focusCalls, 3, 'Outside focus and focus already on the summary stay in place');
});

async function checkoutFixture({ payment = 'bank_transfer', quantity = '5', stock = 3, kakao = true, bank = true, option = false } = {}) {
  const env = environment(`https://himawari.co.kr/checkout.html?product=bag-1&quantity=${quantity}${option ? '&option=blue' : ''}${payment ? '&payment=' + payment : ''}`);
  const form = env.node('[data-checkout-form]');
  const fields = new Map();
  form.elements = { namedItem(name) { if (!fields.has(name)) fields.set(name, new Element('input')); return fields.get(name); } };
  form.elements.namedItem('recipientName');
  form.querySelector = selector => selector === 'button[type="submit"]' ? env.node('submit') : null;
  const product = { id: 'bag-1', name: '가방', model: 'No.1027', price: 48000, stock, options: option ? [{ id: 'blue', label: '블루', stock }] : [] };
  const requests = [];
  let npayItems;
  const context = vm.createContext({
    ...env, URL, URLSearchParams, Intl, crypto, purchaseQuantity,
    bankTransfer: { bank: '은행', account: '000', holder: '예금주' }, bankTransferReady: () => bank,
    initializeCheckoutNpay: getItems => { npayItems = getItems; },
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method || 'GET' });
      assert.equal(options?.method || 'GET', 'GET', 'Disclosure and quantity changes must not create orders');
      const payload = url === '/api/auth/session' ? { authenticated: false }
        : url === '/api/kakaopay/config' ? { enabled: kakao }
          : url === '/api/promotions' ? { coupons: [] } : { product };
      return { ok: true, json: async () => payload };
    },
  });
  const source = await readFile(new URL('../assets/checkout.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('  load();\n', '  globalThis.loadCheckout = load;\n').replace('  load();\r\n', '  globalThis.loadCheckout = load;\r\n'), context);
  await context.loadCheckout();
  return { ...env, form, fields, requests, npayItems: () => npayItems?.() };
}

test('selected checkout method opens delivery directly without stealing initial focus; changing methods retains data and Npay', async () => {
  const page = await checkoutFixture({ option: true });
  assert.equal(page.node('[data-checkout-content]').hidden, false);
  assert.equal(page.node('[data-payment-options]').hidden, true);
  assert.equal(page.node('[data-payment-name]').textContent, '무통장입금');
  assert.equal(page.form.hidden, false);
  assert.equal(page.fields.get('recipientName').focused, undefined);
  assert.equal(page.node('[data-order-count]').textContent, '3개');
  assert.equal(page.npayItems(), undefined, 'The Npay SDK is deferred until its chooser is visible');
  const npay = page.node('[data-npay-checkout-section]');
  page.fields.get('recipientName').value = '작성한 이름';
  page.node('[data-payment-change]').dispatch('click');
  assert.deepEqual(JSON.parse(JSON.stringify(page.npayItems())), [{ productId: 'bag-1', optionId: 'blue', quantity: 3 }]);
  assert.equal(page.node('[data-payment-options]').hidden, false);
  assert.equal(page.node('[data-payment-change]').attributes['aria-expanded'], 'true');
  assert.equal(page.node('[data-npay-checkout-section]'), npay);
  page.node('[data-kakaopay-select]').dispatch('click');
  assert.equal(page.node('[data-payment-name]').textContent, '카카오페이');
  assert.equal(page.node('[data-payment-options]').hidden, true);
  assert.equal(page.node('[data-bank-instructions]').hidden, true);
  assert.equal(page.fields.get('recipientName').value, '작성한 이름');
  assert.equal(page.fields.get('recipientName').focused, true);
  assert.equal(new URL(page.location.href).searchParams.get('payment'), 'kakaopay');
  assert.equal(new URL(page.location.href).searchParams.get('option'), 'blue');
  page.node('[data-payment-change]').dispatch('click');
  page.node('[data-bank-select]').dispatch('click');
  assert.equal(page.node('[data-payment-name]').textContent, '무통장입금');
  assert.equal(page.node('[data-kakaopay-instructions]').hidden, true);
  const quantityControls = page.node('[data-checkout-items]').children[0].children[1].children[3].children[0];
  quantityControls.children[0].dispatch('click');
  assert.equal(page.node('[data-order-count]').textContent, '2개');
  assert.equal(page.npayItems()[0].quantity, 2);
});

test('checkout without a method shows the chooser; unavailable requested method and sold-out stock fail safely', async () => {
  const initial = await checkoutFixture({ payment: '' });
  assert.equal(initial.form.hidden, true);
  assert.equal(initial.node('[data-payment-options]').hidden, false);
  const unavailable = await checkoutFixture({ payment: 'kakaopay', kakao: false });
  assert.equal(unavailable.form.hidden, true);
  assert.equal(unavailable.node('[data-kakaopay-section]').hidden, true);
  assert.equal(unavailable.node('[data-payment-notice]').hidden, false);
  unavailable.node('[data-bank-select]').dispatch('click');
  assert.equal(unavailable.form.hidden, false);
  const soldOut = await checkoutFixture({ stock: 0 });
  assert.equal(soldOut.node('[data-checkout-content]').hidden, true);
  assert.equal(soldOut.node('[data-checkout-error]').hidden, false);
  assert.match(soldOut.node('[data-checkout-error-message]').textContent, /품절/);
});

test('checkout source order confirms products and totals before the shipping form', async () => {
  const html = await readFile(new URL('../checkout.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('class="checkout-summary"') < html.indexOf('class="checkout-form"'));
  assert.match(html, /data-payment-change aria-expanded="false" aria-controls="checkout-method-options"/);
});
