import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { purchaseQuantity, purchaseLimit } from '../assets/purchase-quantity.js';

const source = readFileSync(new URL('../product-detail.js', import.meta.url), 'utf8');
const controlsSource = source.slice(source.indexOf('function setupPurchaseDisclosure('), source.indexOf('function setupCustomerFeatures('));

function setup(product, { quantity = 1, products = [product], compact = true } = {}) {
  const document = { activeElement: null, documentElement: { style: {} } };
  function node() {
    const attrs = new Map(), listeners = new Map(), queries = new Map();
    return {
      dataset: {}, options: [], value: '', hidden: false, disabled: false, open: true, style: {}, queries,
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
      removeAttribute(name) { attrs.delete(name); if (name === 'href') delete this.href; },
      addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(callback); },
      dispatchEvent(event) { for (const callback of listeners.get(event.type) || []) callback(event); return !event.defaultPrevented; },
      focus() { document.activeElement = this; },
      append(...items) { this.options.push(...items); },
      replaceChildren(...items) { this.options = items; },
      cloneNode() { return Object.assign(node(), { value: this.value, textContent: this.textContent, disabled: this.disabled }); },
      querySelector(selector) { return queries.get(selector) || null; },
    };
  }
  const nodes = Object.fromEntries([
    '[data-option-picker]', '[data-product-option]', '[data-stock-status]', '[data-selected-price]',
    '[data-option-error]', '#product-option-label', '[data-mobile-purchase]', '[data-restock-form]',
  ].map(selector => [selector, node()]));
  const sticky = nodes['[data-mobile-purchase]'];
  for (const selector of ['[data-sticky-select]', '[data-quantity-minus]', '[data-quantity-plus]', '[data-purchase-quantity]', '[data-sticky-price]', '[data-purchase-selection]', '[data-purchase-help]', '[data-purchase-disclosure]', '[data-purchase-toggle-label]']) sticky.queries.set(selector, node());
  const disclosure = sticky.querySelector('[data-purchase-disclosure]');
  const summary = node();
  disclosure.queries.set('summary', summary);
  disclosure.contains = element => element === summary || [...sticky.queries.values()].includes(element);
  sticky.getBoundingClientRect = () => ({ height: disclosure.open ? 300 : 110 });
  const bodyProperties = {};
  document.body = { style: { setProperty(key, value) { bodyProperties[key] = value; } } };
  document.querySelector = selector => nodes[selector] || null;
  document.createElement = node;
  const viewport = node();
  viewport.matches = compact;
  const assigned = [];
  const location = { search: `?id=${product.id}&quantity=${quantity}`, href: `https://himawari.co.kr/product.html?id=${product.id}&quantity=${quantity}`, assign(url) { assigned.push(url); } };
  const context = vm.createContext({ document, window: { matchMedia: () => viewport, addEventListener() {} }, location, URL, URLSearchParams, Event, purchaseQuantity, purchaseLimit, priceFormatter: new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }), productFamilyKey: p => p.model, productVariantLabel: p => p.variantLabel || p.id });
  vm.runInContext(controlsSource, context);
  const cart = node(), npay = node();
  const links = [node(), node(), node()];
  links[1].dataset.stickyPayment = 'kakaopay';
  links[2].dataset.stickyPayment = 'bank_transfer';
  context.configureInventory(product, cart, links, npay, products);
  return { context, document, nodes, sticky, disclosure, summary, viewport, cart, npay, links, assigned, bodyProperties };
}

const product = { id: 'bag', name: '가방', model: 'No.1027', price: 76000, stock: 8, soldOut: false, options: [{ id: 'navy', label: '네이비', stock: 8 }, { id: 'sage', label: '세이지', stock: 2 }, { id: 'empty', label: '품절 색상', stock: 0 }] };

test('mobile disclosure preserves selected option and quantity across opening, Escape and viewport changes', () => {
  const h = setup(product, { quantity: 4 });
  h.context.setupPurchaseDisclosure(h.sticky);
  assert.equal(h.disclosure.open, false);
  assert.equal(h.bodyProperties['--purchase-bar-height'], '110px');
  assert.equal(h.document.documentElement.style.scrollPaddingBottom, '142px');
  h.disclosure.open = true;
  h.disclosure.dispatchEvent(new Event('toggle'));
  const select = h.sticky.querySelector('[data-sticky-select]');
  select.value = 'navy'; select.dispatchEvent(new Event('change'));
  select.focus();
  const escape = new Event('keydown', { cancelable: true });
  Object.defineProperty(escape, 'key', { value: 'Escape' });
  h.sticky.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(h.disclosure.open, false);
  assert.equal(h.document.activeElement, h.summary);
  assert.equal(h.cart.dataset.quantity, '4');
  assert.equal(select.value, 'navy');
  h.viewport.matches = false; h.viewport.dispatchEvent(new Event('change'));
  assert.equal(h.disclosure.open, true);
  assert.equal(h.bodyProperties['--purchase-bar-height'], '300px');
  select.focus();
  h.viewport.matches = true; h.viewport.dispatchEvent(new Event('change'));
  assert.equal(h.disclosure.open, false);
  assert.equal(h.document.activeElement, h.summary);
  assert.equal(h.cart.dataset.quantity, '4');
});

test('stock changes and quantity controls synchronize cart, normal checkout, Kakao, bank and Npay', () => {
  const h = setup(product, { quantity: 4 });
  assert.equal(h.cart.disabled, true);
  assert.ok(h.links.every(link => !link.href));
  const select = h.sticky.querySelector('[data-sticky-select]');
  assert.equal(select.options.find(option => option.value === 'empty').disabled, true);
  select.value = 'sage'; select.dispatchEvent(new Event('change'));
  assert.equal(h.cart.disabled, false);
  assert.equal(h.cart.dataset.quantity, '2');
  assert.equal(h.cart.dataset.optionId, 'sage');
  assert.equal(h.npay.dataset.quantity, '2');
  assert.equal(h.npay.dataset.optionId, 'sage');
  assert.equal(h.sticky.querySelector('[data-quantity-plus]').disabled, true);
  assert.equal(h.sticky.querySelector('[data-sticky-price]').textContent, '₩152,000');
  for (const link of h.links) {
    const params = new URL(link.href, 'https://himawari.co.kr/').searchParams;
    assert.equal(params.get('option'), 'sage');
    assert.equal(params.get('quantity'), '2');
    assert.equal(params.get('payment') || '', link.dataset.stickyPayment || '');
  }
  h.sticky.querySelector('[data-quantity-minus]').dispatchEvent(new Event('click'));
  assert.equal(h.cart.dataset.quantity, '1');
  assert.equal(h.npay.dataset.quantity, '1');
  assert.equal(h.sticky.querySelector('[data-quantity-minus]').disabled, true);
  assert.ok(h.links.every(link => new URL(link.href, 'https://himawari.co.kr/').searchParams.get('quantity') === '1'));
  const bodySelect = h.nodes['[data-product-option]'];
  bodySelect.value = ''; bodySelect.dispatchEvent(new Event('change'));
  assert.equal(select.value, '');
  assert.equal(h.cart.disabled, true);
  assert.ok(h.links.every(link => !link.href));
  bodySelect.value = 'empty'; bodySelect.dispatchEvent(new Event('change'));
  assert.equal(h.cart.disabled, true);
  assert.equal(h.npay.dataset.soldOut, 'true');
});

test('native sibling-product selector carries quantity and clamps it to the destination stock', () => {
  const single = { ...product, options: [] };
  const sibling = { ...single, id: 'sage-bag', stock: 2 };
  const h = setup(single, { quantity: 4, products: [single, sibling] });
  const select = h.sticky.querySelector('[data-sticky-select]');
  assert.equal(select.disabled, false);
  select.value = sibling.id; select.dispatchEvent(new Event('change'));
  const destination = new URL(h.assigned[0]);
  assert.equal(destination.searchParams.get('id'), sibling.id);
  assert.equal(destination.searchParams.get('quantity'), '2');
  assert.equal(h.cart.dataset.quantity, '4');
});
