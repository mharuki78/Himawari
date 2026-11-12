import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { renderProductPage } from '../api/_lib/storefront.js';
import { purchaseQuantity, purchaseLimit } from '../assets/purchase-quantity.js';

const template = readFileSync(new URL('../templates/product.html', import.meta.url), 'utf8');
const offerId = '11111111-1111-4111-8111-111111111111';
const product = { id: 'fixture-bag', model: 'Fixture', name: 'Fixture bag', price: 76000, image: 'https://example.invalid/front.jpg', gallery: ['https://example.invalid/detail.jpg'], description: 'Real product description', tagline: 'Real tagline', url: 'https://example.invalid/store', specs: { material: 'Nylon', dimensions: '30 × 40 cm' }, stock: 9, soldOut: false, options: [{ id: 'navy', label: 'Navy', stock: 7 }, { id: 'mint', label: 'Mint', stock: 2 }] };
const offer = { offerId, productId: product.id, optionId: 'mint', optionLabel: 'Mint', price: 39000, regularPrice: 76000, remaining: 2 };
const endsAt = '2099-11-27T15:00:00.000Z';
const event = { state: 'open', endsAt, serverTime: '2099-11-27T00:00:00.000Z', items: [offer] };
const bf = { offer, endsAt };

test('full BF detail retains real description, gallery, specs and review summary with canonical discounted schema', () => {
  const html = renderProductPage(template, product, 'https://himawari.co.kr', { aggregate: { count: 3, ratingValue: 4.7 }, reviews: [] }, [product], bf);
  assert.match(html, /Real product description/);
  assert.match(html, /https:\/\/example.invalid\/detail.jpg/);
  assert.match(html, /30 × 40 cm/);
  assert.match(html, /리뷰 3개/);
  assert.ok(html.includes('href="https://himawari.co.kr/black-friday/item/' + offerId + '/"'));
  assert.match(html, /data-black-friday-offer-id="11111111-1111-4111-8111-111111111111"/);
  assert.match(html, /data-price="39000"/);
  assert.doesNotMatch(html, /data-npay-product data-product-id=/);
  assert.doesNotMatch(html, /data-npay-product-section/);
  const schema = JSON.parse(html.match(/<script id="bf-json-ld" type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.url, 'https://himawari.co.kr/black-friday/item/' + offerId + '/');
  assert.equal(schema.offers.price, 39000);
  assert.equal(schema.offers.validThrough, endsAt);
  assert.equal(schema.offers.availability, 'https://schema.org/InStock');
  assert.equal(schema.aggregateRating.reviewCount, '3');
});

test('depleted BF detail stays discounted and out of stock without a regular-price checkout fallback', () => {
  const html = renderProductPage(template, product, 'https://himawari.co.kr', null, [product], { ...bf, offer: { ...offer, remaining: 0 } });
  const schema = JSON.parse(html.match(/<script id="bf-json-ld" type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(schema.offers.price, 39000);
  assert.equal(schema.offers.availability, 'https://schema.org/OutOfStock');
  assert.doesNotMatch(html, /href="checkout.html\?product=/);
  assert.doesNotMatch(html, /href="[^\"]*blackFriday=/);
});

test('public offer refresh resolves the real product and exact option, blocking stale prices and ended identities', async () => {
  const { resolveBlackFridayDetail } = await import('../assets/black-friday-product-context.js');
  const result = resolveBlackFridayDetail(event, offerId, [product], 39000);
  assert.equal(result.product.id, 'fixture-bag');
  assert.equal(result.product.price, 39000);
  assert.equal(result.product.stock, 2);
  assert.equal(result.product.options[0].id, 'mint');
  assert.equal(result.product.options.length, 1);
  assert.throws(() => resolveBlackFridayDetail(event, offerId, [product], 38000));
  assert.throws(() => resolveBlackFridayDetail({ ...event, state: 'closed' }, offerId, [product]));
  assert.throws(() => resolveBlackFridayDetail({ ...event, serverTime: endsAt }, offerId, [product]));
  assert.throws(() => resolveBlackFridayDetail({ ...event, items: [{ ...offer, optionId: 'missing' }] }, offerId, [product]));
});

test('BF purchase controls keep the selected offer, clamp quota, and route all payment actions through BF checkout', () => {
  const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
  const controls = source.slice(source.indexOf('function setupPurchaseDisclosure('), source.indexOf('function setupCustomerFeatures('));
  const makeNode = () => ({ dataset: {}, options: [], value: '', hidden: false, disabled: false, queries: new Map(), listeners: new Map(), setAttribute() {}, removeAttribute(name) { if (name === 'href') delete this.href; }, append(...nodes) { this.options.push(...nodes); }, replaceChildren(...nodes) { this.options = nodes; }, cloneNode() { return Object.assign(makeNode(), { value: this.value, textContent: this.textContent, disabled: this.disabled }); }, querySelector(s) { return this.queries.get(s); }, addEventListener(type, fn) { this.listeners.set(type, fn); }, dispatchEvent(e) { this.listeners.get(e.type)?.(e); } });
  const nodes = Object.fromEntries(['[data-option-picker]', '[data-product-option]', '[data-stock-status]', '[data-selected-price]', '[data-option-error]', '#product-option-label'].map(s => [s, makeNode()]));
  const document = { querySelector: s => nodes[s] || null, createElement: makeNode };
  const cart = makeNode(), npay = makeNode(), links = [makeNode(), makeNode()];
  links[1].dataset.stickyPayment = 'bank_transfer';
  const context = vm.createContext({ document, window: {}, location: { search: '?quantity=8' }, URLSearchParams, Event, purchaseQuantity, purchaseLimit, priceFormatter: new Intl.NumberFormat('ko-KR'), productFamilyKey: p => p.model });
  vm.runInContext(controls, context);
  context.configureInventory({ ...product, price: 39000, stock: 2, options: [{ ...product.options[1], stock: 2 }] }, cart, links, npay, [product], bf);
  assert.equal(cart.disabled, false);
  assert.equal(cart.dataset.optionId, 'mint');
  assert.equal(cart.dataset.quantity, '2');
  assert.equal(cart.dataset.blackFridayOfferId, offerId);
  for (const link of links) {
    const url = new URL(link.href, 'https://himawari.co.kr');
    assert.equal(url.searchParams.get('blackFriday'), offerId);
    assert.equal(url.searchParams.get('quantity'), '2');
    assert.equal(url.searchParams.has('product'), false);
  }
  assert.equal(new URL(links[1].href, 'https://himawari.co.kr').searchParams.get('payment'), 'bank_transfer');
});

test('BF detail reload resolves its real product from the route and validates the public offer before rendering controls', async () => {
  const { blackFridayOfferFromPath, resolveBlackFridayDetail } = await import('../assets/black-friday-product-context.js');
  const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
  const loader = source.slice(source.indexOf('async function loadProduct()'), source.lastIndexOf('loadProduct();'));
  const seen = [], rendered = [];
  const context = vm.createContext({
    main: { dataset: { blackFridayUnitPrice: '39000' } },
    location: { pathname: '/black-friday/item/' + offerId + '/', search: '' }, URLSearchParams,
    blackFridayOfferFromPath, resolveBlackFridayDetail,
    fetchProducts: async () => [product],
    fetch: async (url, options) => { seen.push([url, options.cache]); return { ok: true, json: async () => event }; },
    renderProduct: (...args) => rendered.push(args), renderProductGuidance() {},
    renderUnavailable() { assert.fail('active BF route must load without a product query'); },
    renderNotFound() { assert.fail('active BF route must resolve the actual product'); },
  });
  vm.runInContext(loader, context);
  await context.loadProduct();
  assert.deepEqual(seen, [['/api/products?route=black-friday', 'no-store']]);
  assert.equal(rendered[0][0].id, 'fixture-bag');
  assert.equal(rendered[0][0].price, 39000);
  assert.equal(rendered[0][2].offer.offerId, offerId);
});

test('BF detail refresh blocks a changed public price instead of showing regular purchase controls', async () => {
  const { blackFridayOfferFromPath, resolveBlackFridayDetail } = await import('../assets/black-friday-product-context.js');
  const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
  const loader = source.slice(source.indexOf('async function loadProduct()'), source.lastIndexOf('loadProduct();'));
  const nodes = new Map();
  let unavailable = false;
  const context = vm.createContext({
    main: { dataset: { blackFridayUnitPrice: '38000' } },
    location: { pathname: '/black-friday/item/' + offerId + '/', search: '?id=fixture-bag' }, URLSearchParams,
    blackFridayOfferFromPath, resolveBlackFridayDetail,
    fetchProducts: async () => [product], fetch: async () => ({ ok: true, json: async () => event }),
    renderProduct() { assert.fail('stale offer must never render a retail fallback'); }, renderProductGuidance() {},
    renderUnavailable() { unavailable = true; }, renderNotFound() { assert.fail('stale identity needs an explicit BF error'); }, blockBlackFridayPurchase() {},
    document: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); } },
  });
  vm.runInContext(loader, context);
  await context.loadProduct();
  assert.equal(unavailable, true);
  assert.equal(nodes.get('[data-state-action]').href, '/black-friday/');
});

test('revalidated depleted quota updates BF Product schema while retaining product images and review evidence', async () => {
  const { refreshBlackFridayProductSchema } = await import('../assets/black-friday-product-context.js');
  assert.equal(typeof refreshBlackFridayProductSchema, 'function');
  const schema = { '@type': 'Product', image: ['https://example.invalid/detail.jpg'], aggregateRating: { reviewCount: '3' }, offers: { priceCurrency: 'KRW', availability: 'https://schema.org/InStock' } };
  const updated = refreshBlackFridayProductSchema(schema, { product: { ...product, stock: 0, soldOut: true }, ...bf }, 'https://himawari.co.kr');
  assert.equal(updated.offers.price, 39000);
  assert.equal(updated.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(updated.offers.validThrough, endsAt);
  assert.equal(updated.url, 'https://himawari.co.kr/black-friday/item/' + offerId + '/');
  assert.deepEqual(updated.image, ['https://example.invalid/detail.jpg']);
  assert.equal(updated.aggregateRating.reviewCount, '3');
});

test('BF detail lifecycle expires against authoritative server time despite client clock skew', async () => {
  const { createBlackFridayDetailLifecycle } = await import('../assets/black-friday-product-context.js');
  assert.equal(typeof createBlackFridayDetailLifecycle, 'function');
  let clock = 1000, nextId = 0;
  const timers = new Map(), blocks = [], listeners = new Map();
  const target = { hidden: false, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const lifecycle = createBlackFridayDetailLifecycle({ context: { ...bf, serverTime: '2099-11-27T14:59:55.000Z' }, refresh: async () => { throw new Error('must not fetch to enforce expiry'); }, onBlock: message => blocks.push(message), onUpdate() { assert.fail('expiry must never re-enable controls'); }, document: target, window: target,
    now: () => clock, setTimer(fn, delay) { const id = ++nextId; timers.set(id, { fn, delay }); return id; }, clearTimer(id) { timers.delete(id); } });
  assert.equal([...timers.values()].some(timer => timer.delay === 5000), true);
  clock = 6000;
  await [...timers.values()].find(timer => timer.delay === 5000).fn();
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /종료/);
  lifecycle.dispose();
  assert.equal(timers.size, 0);
});

test('BF visibility and BFCache revalidation suspend actions then update in place with one lifecycle listener each', async () => {
  const { createBlackFridayDetailLifecycle } = await import('../assets/black-friday-product-context.js');
  assert.equal(typeof createBlackFridayDetailLifecycle, 'function');
  const listeners = new Map(), blocks = [], updates = [];
  let refreshCount = 0, id = 0;
  const target = { hidden: false, addEventListener(type, fn) { assert.equal(listeners.has(type), false); listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const lifecycle = createBlackFridayDetailLifecycle({ context: { ...bf, serverTime: '2099-11-27T14:59:55.000Z' }, refresh: async () => { refreshCount++; return { ...bf, serverTime: '2099-11-27T14:59:56.000Z', product: { ...product, stock: 1 } }; }, onBlock: message => blocks.push(message), onUpdate: context => updates.push(context), document: target, window: target, now: () => 1000, setTimer() { return ++id; }, clearTimer() {} });
  await listeners.get('visibilitychange')();
  assert.equal(blocks.length, 1);
  assert.equal(updates[0].product.stock, 1);
  await listeners.get('pageshow')({ persisted: true });
  assert.equal(refreshCount, 2);
  assert.equal(updates.length, 2);
  assert.equal(listeners.size, 3);
  lifecycle.dispose();
  assert.equal(listeners.size, 0);
});

test('a pre-BFCache request cannot re-enable an offer after restore requires a fresh response', async () => {
  const { createBlackFridayDetailLifecycle } = await import('../assets/black-friday-product-context.js');
  const listeners = new Map(), responses = [], updates = [];
  const target = { hidden: false, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const lifecycle = createBlackFridayDetailLifecycle({ context: { ...bf, serverTime: '2099-11-27T14:59:55.000Z' }, refresh: () => new Promise(resolve => responses.push(resolve)), onBlock() {}, onUpdate: next => updates.push(next), document: target, window: target, now: () => 1000, setTimer() { return 1; }, clearTimer() {} });
  const first = lifecycle.revalidate();
  listeners.get('pagehide')({ persisted: true });
  const restored = listeners.get('pageshow')({ persisted: true });
  assert.equal(responses.length, 2);
  responses[0]({ ...bf, serverTime: '2099-11-27T14:59:55.000Z' });
  await first;
  assert.equal(updates.length, 0);
  responses[1]({ ...bf, serverTime: '2099-11-27T15:00:00.000Z' });
  await restored;
  assert.equal(updates.length, 0);
  lifecycle.dispose();
});

test('detail lifecycle DOM adapter removes closed offer prices and purchase schema without rebinding controls', () => {
  const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
  const adapter = source.slice(source.indexOf('function blockBlackFridayPurchase('), source.indexOf('function renderProduct('));
  let lifecycle;
  const inventory = [];
  const schema = { textContent: JSON.stringify({ '@type': 'Product', offers: { price: 39000 } }), remove() { nodes.delete('#bf-json-ld'); } };
  const nodes = new Map([['#bf-json-ld', schema]]);
  for (const selector of ['[data-detail-cart]', '[data-mobile-purchase]', '[data-black-friday-status]', '[data-price]', '[data-selected-price]', '[data-sticky-price]']) nodes.set(selector, { dataset: { price: '39000' }, textContent: '39000', removeAttribute(name) { if (name === 'data-price') delete this.dataset.price; } });
  const document = { querySelector: selector => nodes.get(selector), querySelectorAll: () => [], createElement: () => ({}), head: { append(node) { nodes.set('#bf-json-ld', node); } } };
  const context = vm.createContext({ document, location: { origin: 'https://himawari.co.kr' }, createBlackFridayDetailLifecycle(options) { lifecycle = options; } });
  vm.runInContext(adapter, context);
  context.setupBlackFridayPurchaseLifecycle(bf, [product], (...args) => inventory.push(args));
  lifecycle.onBlock('행사 종료');
  assert.equal(inventory[0][0], null);
  assert.equal(nodes.get('[data-detail-cart]').dataset.price, undefined);
  assert.equal(nodes.get('[data-price]').textContent, '');
  assert.equal(nodes.get('[data-sticky-price]').textContent, '');
  assert.equal(nodes.get('[data-mobile-purchase]').hidden, true);
  assert.equal(nodes.has('#bf-json-ld'), false);
});

test('initial BF revalidation failures remove SSR purchase prices and InStock schema before lifecycle exists', async () => {
  const { blackFridayOfferFromPath, resolveBlackFridayDetail } = await import('../assets/black-friday-product-context.js');
  const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
  const loader = source.slice(source.indexOf('async function loadProduct()'), source.lastIndexOf('loadProduct();'));
  const blockStart = source.indexOf('function blockBlackFridayPurchase(');
  const block = blockStart >= 0 ? source.slice(blockStart, source.indexOf('function setupBlackFridayPurchaseLifecycle(')) : '';
  for (const response of [
    { ok: true, json: async () => ({ ...event, state: 'closed', items: [] }) },
    { ok: true, json: async () => ({ ...event, items: [] }) },
    { ok: false },
  ]) {
    const nodes = new Map();
    for (const selector of ['[data-detail-cart]', '[data-mobile-purchase]', '[data-black-friday-status]', '[data-price]', '[data-selected-price]', '[data-sticky-price]', '[data-state-title]', '[data-state-message]', '[data-state-action]', '[data-state-action-label]']) nodes.set(selector, { dataset: { price: '39000' }, textContent: '39000', removeAttribute(name) { if (name === 'data-price') delete this.dataset.price; } });
    nodes.set('#bf-json-ld', { textContent: '{"@type":"Product","offers":{"price":39000,"availability":"https://schema.org/InStock"}}', remove() { nodes.delete('#bf-json-ld'); } });
    const links = [{ href: '/checkout.html?blackFriday=' + offerId, removeAttribute(name) { if (name === 'href') delete this.href; }, setAttribute() {} }];
    const document = { querySelector: selector => nodes.get(selector), querySelectorAll: () => links };
    const context = vm.createContext({ document, main: { dataset: { blackFridayUnitPrice: '39000' } }, location: { pathname: '/black-friday/item/' + offerId + '/', search: '' }, URLSearchParams, blackFridayOfferFromPath, resolveBlackFridayDetail,
      fetchProducts: async () => [product], fetch: async () => response, renderProduct() { assert.fail('invalid offer must not render purchase controls'); }, renderProductGuidance() {}, renderUnavailable() {}, renderNotFound() { assert.fail('BF identity needs a specific error'); } });
    vm.runInContext(block + '\n' + loader, context);
    await context.loadProduct();
    assert.equal(nodes.has('#bf-json-ld'), false, 'initial failure must remove stale SSR InStock offers');
    assert.equal(nodes.get('[data-price]').textContent, '');
    assert.equal(nodes.get('[data-detail-cart]').disabled, true);
    assert.equal(nodes.get('[data-detail-cart]').dataset.price, undefined);
    assert.equal(links[0].href, undefined);
  }
});
