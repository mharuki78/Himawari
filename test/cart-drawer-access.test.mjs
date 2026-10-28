import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/cart.js', import.meta.url), 'utf8');

function setup() {
  const documentListeners = new Map();
  const document = { readyState: 'complete', activeElement: null };
  function node() {
    const attributes = new Map(), queries = new Map();
    const element = {
      className: '', inert: false, dataset: {}, children: [], disabled: false, offsetWidth: 44, offsetHeight: 44,
      setAttribute(key, value) { attributes.set(key, String(value)); },
      getAttribute(key) { return attributes.get(key) ?? null; },
      removeAttribute(key) { attributes.delete(key); },
      appendChild(child) { this.children.push(child); },
      addEventListener() {},
      focus() { document.activeElement = this; },
      querySelector(selector) { if (!queries.has(selector)) queries.set(selector, node()); return queries.get(selector); },
      querySelectorAll() { return this.focusTargets || []; },
    };
    element.classList = {
      contains(name) { return element.className.split(' ').includes(name); },
      add(name) { if (!this.contains(name)) element.className += ` ${name}`; },
      remove(name) { element.className = element.className.split(' ').filter(value => value !== name).join(' '); },
      toggle(name, force) { if (force ?? !this.contains(name)) this.add(name); else this.remove(name); },
    };
    return element;
  }
  document.body = node(); document.documentElement = node();
  document.createElement = node;
  document.querySelector = selector => selector === '.rdcart' ? document.body.children.find(child => child.classList.contains('rdcart')) : null;
  document.addEventListener = (name, callback) => { documentListeners.set(name, callback); };
  document.dispatchEvent = () => {};
  const page = node(), preserved = node();
  preserved.inert = true; preserved.setAttribute('aria-hidden', 'true');
  document.body.children.push(page, preserved);
  page.focus();
  const context = vm.createContext({ document, window: { addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class {}, setTimeout() {}, navigator: {} });
  vm.runInContext(source, context);
  const drawer = document.querySelector('.rdcart');
  const panel = drawer.querySelector('.rdcart__panel');
  const close = drawer.querySelector('.rdcart__close');
  const last = node();
  panel.focusTargets = [close, last];
  return { document, documentListeners, page, preserved, drawer, close, last, cart: context.window.SiteCart };
}

test('closed drawer is inert at initialization and after every close, while open focus trap and restoration survive', () => {
  const h = setup();
  assert.equal(h.drawer.inert, true);
  assert.equal(h.drawer.getAttribute('aria-hidden'), 'true');
  h.cart.open();
  assert.equal(h.drawer.inert, false);
  assert.equal(h.page.inert, true);
  assert.equal(h.document.activeElement, h.close);
  let prevented = false;
  h.documentListeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.document.activeElement, h.last);
  h.documentListeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(h.document.activeElement, h.close);
  h.documentListeners.get('keydown')({ key: 'Escape' });
  assert.equal(h.drawer.inert, true);
  assert.equal(h.drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(h.page.inert, false);
  assert.equal(h.page.getAttribute('aria-hidden'), null);
  assert.equal(h.preserved.inert, true);
  assert.equal(h.preserved.getAttribute('aria-hidden'), 'true');
  assert.equal(h.document.activeElement, h.page);
  h.cart.open();
  assert.equal(h.drawer.inert, false);
  assert.equal(h.document.activeElement, h.close);
  h.cart.close();
  assert.equal(h.drawer.inert, true);
  assert.equal(h.document.activeElement, h.page);
});
