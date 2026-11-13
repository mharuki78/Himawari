import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { CATALOG_CATEGORIES, filterAndSortFamilies, groupProductFamilies } from '../assets/catalog-tools.js';
import { purchaseQuantity } from '../assets/purchase-quantity.js';
import { standardShippingFee } from '../assets/shipping-policy.js';
import { WELCOME_COUPON, welcomeCouponSubtotal } from '../assets/welcome-coupon.js';
import { checkoutCartLine, checkoutItemsInput } from '../assets/black-friday-cart.js';
import { orderBenefits } from '../assets/order-summary.js';

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
  getAttribute(name) { return this.attributes[name] ?? null; }
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
    getElementById: id => node('#' + id),
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

async function checkoutFixture({ payment = 'bank_transfer', quantity = '5', stock = 3, kakao = true, bank = true, option = false, sale = false, mixed = false, npay = {enabled:true}, sandbox = false, endsAt = '2099-01-01T00:00:00Z' } = {}) {
  const env = environment(`https://himawari.co.kr/checkout.html?product=bag-1&quantity=${quantity}${option ? '&option=blue' : ''}${payment ? '&payment=' + payment : ''}`);
  const offerId = 'eb3ff32a-dce8-4c79-8dba-c93058eb6247';
  if (sale) env.history.replaceState(null, '', `https://himawari.co.kr/checkout.html?blackFriday=${offerId}&quantity=${quantity}`);
  if (mixed) env.history.replaceState(null, '', 'https://himawari.co.kr/checkout.html');
  if (sandbox) env.history.replaceState(null, '', 'https://himawari.co.kr/npay-sandbox-checkout.html' + env.location.search);
  let clock = Date.now(), timer;
  if (mixed) env.sessionStorage = { getItem: key => key === 'himawari-checkout-items' ? JSON.stringify({createdAt:clock,items:[{productId:'bag-1',optionId:'',quantity:2,blackFriday:{offerId,unitPrice:39000}},{productId:'bag-2',quantity:1}]}) : null, setItem() {} };
  const form = env.node('[data-checkout-form]');
  const fields = new Map();
  form.elements = { namedItem(name) { if (!fields.has(name)) fields.set(name, new Element('input')); return fields.get(name); } };
  form.elements.namedItem('recipientName');
  form.querySelector = selector => selector === 'button[type="submit"]' ? env.node('submit') : null;
  const product = { id: 'bag-1', name: '가방', model: 'No.1027', price: 48000, stock, options: option ? [{ id: 'blue', label: '블루', stock }] : [] };
  const ordinary = { id:'bag-2',name:'일반 가방',price:12000,stock:5,options:[] };
  const campaign = {state:'open',endsAt,items:[{productId:'bag-1',optionId:'',optionLabel:'',name:'행사 가방',offerId,price:39000,regularPrice:59000,remaining:stock}]};
  const requests = [];
  let npayItems;
  const context = vm.createContext({
    ...env, URL, URLSearchParams, Intl, crypto, purchaseQuantity, standardShippingFee, WELCOME_COUPON, welcomeCouponSubtotal, checkoutCartLine, checkoutItemsInput, orderBenefits,
    FormData: class { *[Symbol.iterator]() { yield* [['recipientName','테스트'],['email','test@example.invalid'],['phone','01000000000'],['postalCode','00000'],['addressLine1','테스트 주소']]; } },
    Date: class extends Date { static now() { return clock; } }, setTimeout: callback => { timer=callback;return 1; }, clearTimeout: () => { timer=null; },
    bankTransfer: { bank: '은행', account: '000', holder: '예금주' }, bankTransferReady: () => bank,
    initializeCheckoutNpay: getItems => { npayItems = getItems; },
    fetch: async (url, options) => {
      requests.push({ url, method: options?.method || 'GET' });
      assert.equal(options?.method || 'GET', 'GET', 'Disclosure and quantity changes must not create orders');
      const payload = url === '/api/auth/session' ? { authenticated: false }
        : url === '/api/npay/config' ? npay : url === '/api/kakaopay/config' ? { enabled: kakao }
          : url === '/api/promotions' ? { coupons: [] } : url === '/api/black-friday' ? campaign : url === '/api/products' ? {products:[product,ordinary]} : { product };
      return { ok: true, json: async () => payload };
    },
  });
  const source = await readFile(new URL('../assets/checkout.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('  load();\n', '  globalThis.loadCheckout = load;\n').replace('  load();\r\n', '  globalThis.loadCheckout = load;\r\n'), context);
  await context.loadCheckout();
  return { ...env, form, fields, requests, npayItems: () => npayItems?.(), expire() { assert.equal(typeof timer,'function');clock=Date.parse(endsAt)+1;timer(); }, extend() { campaign.endsAt='2099-01-01T00:00:00Z'; } };
}

const descendants = node => [node, ...(node.children || []).flatMap(descendants)];
const withClass = (node, name) => descendants(node).filter(element => (element.className || '').split(' ').includes(name));

test('direct and mixed campaign checkout show unit discount details separately from quantity totals', async () => {
  for (const mode of [{sale:true},{mixed:true}]) {
    const page=await checkoutFixture({...mode,quantity:'2'});
    assert.equal(page.node('[data-checkout-content]').hidden,false);
    const rows=page.node('[data-checkout-items]').children;
    assert.equal(rows.length,mode.mixed?2:1);
    const original=descendants(rows[0]).find(node=>node.tagName==='del');
    assert.ok(original,'A verified campaign line needs its original unit price');
    assert.match(original.textContent,/59,000/);
    assert.match(withClass(rows[0],'checkout-item__sale-price')[0].textContent,/39,000/);
    assert.equal(withClass(rows[0],'checkout-item__discount')[0].textContent,'34% 할인');
    assert.match(page.node('[data-order-subtotal]').textContent,mode.mixed?/90,000/:/78,000/);
    const controls=withClass(rows[0],'checkout-item__quantity')[0];controls.children[0].dispatch('click');
    assert.match(page.node('[data-order-subtotal]').textContent,mode.mixed?/51,000/:/39,000/);
    assert.match(withClass(page.node('[data-checkout-items]'),'checkout-item__sale-price')[0].textContent,/39,000/);
    if(mode.mixed)assert.equal(descendants(rows[1]).some(node=>node.tagName==='del'),false);
  }
});

test('checkout benefits and mobile action follow current totals and chosen payment without submitting', async()=>{
  const page=await checkoutFixture({mixed:true});
  assert.match(page.node('[data-order-savings]').textContent,/40,000/);
  assert.match(page.node('[data-mobile-total]').textContent,/90,000/);
  assert.equal(page.node('[data-mobile-checkout]').textContent,'구매 방법 선택');
  assert.match(page.node('[data-order-shipping-progress-text]').textContent,/무료배송/);
  page.node('[data-bank-select]').dispatch('click');
  assert.equal(page.node('[data-mobile-checkout]').textContent,'무통장입금 주문 접수');
  withClass(page.node('[data-checkout-items]'),'checkout-item__quantity')[0].children[0].dispatch('click');
  assert.match(page.node('[data-order-savings]').textContent,/20,000/);
  assert.match(page.node('[data-mobile-total]').textContent,/54,500/);
  assert.match(page.node('[data-order-shipping-progress-text]').textContent,/19,000/);
  assert.equal(page.requests.every(request=>request.method==='GET'),true);
});
test('a failed synthetic order restores the mobile action label with its enabled state',async()=>{
 const page=await checkoutFixture();page.form.elements.namedItem('termsConsent').checked=true;page.form.elements.namedItem('privacyConsent').checked=true;
 await page.form.dispatch('submit');
 assert.equal(page.node('[data-mobile-checkout]').textContent,'무통장입금 주문 접수');
 assert.equal(page.node('[data-mobile-checkout]').disabled,false);
});

test('campaign checkout removes discount details and requires rechecking when the campaign expires while open', async () => {
  const page=await checkoutFixture({mixed:true,endsAt:new Date(Date.now()+10000).toISOString()});
  assert.equal(withClass(page.node('[data-checkout-items]'),'checkout-item__discount').length,1);
  page.expire();
  assert.equal(page.node('[data-checkout-content]').hidden,true);
  assert.equal(page.node('[data-checkout-error]').hidden,false);
  assert.equal(page.node('[data-checkout-items]').children.length,0);
  assert.equal(page.node('submit').disabled,true);
  page.extend();await page.node('[data-checkout-retry]').dispatch('click');
  assert.equal(page.node('[data-checkout-content]').hidden,false);
  assert.equal(page.node('submit').disabled,false,'A successfully revalidated extended campaign must allow checkout again');
});

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

test('campaign Npay stays visible with an unavailable explanation without initializing ordinary-price checkout', async () => {
  for (const mode of [{sale:true},{mixed:true}]) {
    const page = await checkoutFixture({...mode, quantity:'2'});
    assert.equal(page.node('[data-npay-checkout-section]').hidden, false);
    assert.equal(page.node('#npay-checkout-button').hidden, true);
    assert.equal(page.node('[data-npay-unavailable]').hidden, false);
    assert.match(page.node('[data-npay-status]').textContent, /블랙 프라이데이.*Npay.*준비 중/);
    assert.equal(page.npayItems(), undefined);
    page.node('[data-bank-select]').dispatch('click');
    page.node('[data-payment-change]').dispatch('click');
    assert.equal(page.npayItems(), undefined, 'Changing payment methods cannot drop campaign prices into ordinary Npay');
    assert.equal(page.node('[data-npay-unavailable]').hidden, false);
  }
  const ordinary = await checkoutFixture({payment:'',option:true,quantity:'2'});
  assert.equal(ordinary.node('[data-npay-checkout-section]').hidden, false);
  assert.equal(ordinary.node('#npay-checkout-button').hidden, false);
  assert.equal(ordinary.node('[data-npay-unavailable]').hidden, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ordinary.npayItems())), [{productId:'bag-1',optionId:'blue',quantity:2}]);
});

test('checkout source order confirms products and totals before payment selection and shipping', async () => {
  const html = await readFile(new URL('../checkout.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('class="checkout-summary"') < html.indexOf('class="checkout-section checkout-methods"'));
  assert.ok(html.indexOf('class="checkout-summary"') < html.indexOf('class="checkout-form"'));
  assert.match(html, /data-payment-change aria-expanded="false" aria-controls="checkout-method-options"/);
});

test('explicit server capability enables campaign checkout while preserving its verified payload',async()=>{
 for(const mode of [{sale:true},{mixed:true}]) {
  const page=await checkoutFixture({...mode,quantity:'2',npay:{enabled:true,blackFriday:{enabled:true}}});
  assert.equal(page.node('#npay-checkout-button').hidden,false);
  assert.equal(page.node('[data-npay-unavailable]').hidden,true);
  assert.deepEqual(JSON.parse(JSON.stringify(page.npayItems())),[{productId:'bag-1',optionId:'',quantity:2,blackFriday:{offerId:'eb3ff32a-dce8-4c79-8dba-c93058eb6247',unitPrice:39000}},...(mode.mixed?[{productId:'bag-2',optionId:'',quantity:1}]:[])]);
 }
 const disabled=await checkoutFixture({mixed:true,npay:{enabled:false,blackFriday:{enabled:true}}});
 assert.equal(disabled.node('[data-npay-unavailable]').hidden,false);assert.equal(disabled.npayItems(),undefined);
});

test('private sandbox checkout shows the Npay action only with explicit server review capability',async()=>{
 for(const sandbox of [false,true]) {
  const page=await checkoutFixture({mixed:true,sandbox,npay:{enabled:true,review:true,blackFriday:{enabled:true}}});
  assert.equal(page.node('#npay-checkout-button').hidden,!sandbox);
  assert.equal(page.node('[data-npay-unavailable]').hidden,sandbox);
  assert.equal(Boolean(page.npayItems()),sandbox);
 }
});
