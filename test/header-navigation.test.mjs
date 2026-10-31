import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const navigationSource = source.slice(source.indexOf('function syncSiteNavigation()'), source.indexOf('\nsyncSiteNavigation();'));
const tooltipSource = source.slice(source.indexOf('function initializeHeaderTooltips()'), source.indexOf('\ninitializeHeaderTooltips();'));

function setup(pathname = '/') {
  const documentListeners = new Map(), windowListeners = new Map(), observers = [], timers = new Map();
  let timerId = 0;
  const document = { activeElement: null };
  function node(tagName = 'div') {
    const attributes = new Map(), listeners = new Map(), properties = new Map();
    const element = {
      tagName, children: [], dataset: {}, className: '', textContent: '', disabled: false, visible: true,
      bounds: { left: 200, bottom: 72, width: 44, height: 44 },
      style: { setProperty(key, value) { properties.set(key, value); }, getPropertyValue(key) { return properties.get(key); } },
      setAttribute(key, value) { attributes.set(key, String(value)); },
      getAttribute(key) { return attributes.get(key) ?? null; },
      hasAttribute(key) { return attributes.has(key); },
      matches(selector) {
        return selector.split(',').some(part => {
          if (part.startsWith('.')) return this.className.split(' ').includes(part.slice(1));
          if (part.startsWith('[')) return this.hasAttribute(part.slice(1, -1));
          return this.tagName === part;
        });
      },
      append(...children) {
        children.forEach(child => { child.remove(); child.parentNode = this; this.children.push(child); });
      },
      prepend(child) { child.remove(); child.parentNode = this; this.children.unshift(child); },
      replaceChildren(...children) { [...this.children].forEach(child => child.remove()); this.append(...children); },
      remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
      },
      querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
      },
      emit(type, event = {}) { for (const callback of listeners.get(type) || []) callback(event); },
      getClientRects() { return this.visible ? [this.bounds] : []; },
      getBoundingClientRect() { return this.className === 'header-tooltip' ? { width: 120, height: 30 } : this.bounds; },
      get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); },
    };
    for (const name of ['href', 'src', 'id']) Object.defineProperty(element, name, { get() { return this.getAttribute(name); }, set(value) { this.setAttribute(name, value); } });
    return element;
  }
  document.body = node('body');
  document.createElement = node;
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => [document.body, ...document.body.querySelectorAll('span')].find(element => element.id === id) || null;
  document.addEventListener = (type, callback) => documentListeners.set(type, callback);
  const window = {
    location: { pathname }, innerWidth: 390, innerHeight: 844,
    addEventListener(type, callback) { windowListeners.set(type, callback); },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const header = node('header'); header.className = 'site-header';
  const navigation = node('nav'); navigation.className = 'site-nav';
  document.body.append(header); header.append(navigation);
  const context = vm.createContext({ document, window, MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} } });
  vm.runInContext(`${navigationSource}\n${tooltipSource}`, context);
  function trigger(className, attributes = {}) {
    const button = node('button'); button.className = className;
    for (const [key, value] of Object.entries(attributes)) button.setAttribute(key, value);
    header.append(button);
    return button;
  }
  return {
    document, window, header, navigation, context, trigger, documentListeners, windowListeners,
    sync() { observers.forEach(callback => callback()); },
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); },
    tooltip(button) { return document.getElementById(button.getAttribute('aria-describedby').split(' ').at(-1)); },
  };
}

test('all eight navigation routes have one decorative Phosphor glyph and retain their route and active state', () => {
  const routes = ['/products.html', '/finder.html', '/lookbook/', '/story/', '/guidebook.html', '/about.html', '/game.html', '/contact.html'];
  for (const pathname of routes) {
    const h = setup(pathname);
    h.context.syncSiteNavigation();
    h.context.syncSiteNavigation();
    assert.deepEqual(h.navigation.children.map(link => link.href), routes);
    assert.deepEqual(h.navigation.children.filter(link => link.getAttribute('aria-current') === 'page').map(link => link.href), [pathname]);
    for (const link of h.navigation.children) {
      assert.equal(link.children.length, 1);
      const icon = link.children[0];
      assert.equal(icon.alt, ''); assert.equal(icon.width, 16); assert.equal(icon.height, 16);
      const svg = readFileSync(new URL('..' + icon.src, import.meta.url), 'utf8');
      assert.match(svg, /viewBox="0 0 256 256"/);
      assert.match(svg, /fill="currentColor"/);
    }
  }
});

test('utility descriptions survive late member/store insertion, member text replacement and repeated sync without duplicates', () => {
  const h = setup();
  const search = h.trigger('header-icon', { 'data-header-search': '', 'aria-label': '가방 검색', 'aria-describedby': 'existing-help' });
  const cart = h.trigger('header-icon', { 'data-cart-button': '', 'aria-label': '장바구니 열기' });
  h.context.initializeHeaderTooltips();
  const member = h.trigger('member-trigger', { 'aria-label': '로그인 메뉴 열기' });
  const store = h.trigger('header-store', { 'aria-expanded': 'false' });
  h.sync(); h.sync();
  assert.equal(h.document.querySelectorAll('.header-tooltip').length, 4);
  assert.match(search.getAttribute('aria-describedby'), /^existing-help header-tooltip-\d+$/);
  for (const button of [search, cart, member, store]) assert.equal(h.tooltip(button).getAttribute('role'), 'tooltip');
  member.textContent = 'MY'; member.setAttribute('aria-label', '회원 메뉴 열기'); h.sync();
  assert.equal(h.tooltip(member).textContent, '회원 메뉴 열기');
  assert.equal(member.dataset.headerTooltip, '회원 메뉴 열기');
  store.setAttribute('aria-expanded', 'true'); h.sync();
  assert.equal(h.tooltip(store).textContent, '공식 스토어 닫기');
  assert.equal(store.getAttribute('aria-label'), '공식 스토어 닫기');
  store.remove(); h.sync();
  assert.equal(h.document.querySelectorAll('.header-tooltip').length, 3);
});

test('tooltips support focus, hover-gap crossing, Escape suppression, viewport clamping and unchanged click actions', () => {
  const h = setup();
  const menu = h.trigger('menu-button', { 'aria-expanded': 'false' });
  const cart = h.trigger('header-icon', { 'data-cart-button': '', 'aria-label': '장바구니 열기' });
  let cartOpened = 0; cart.addEventListener('click', () => cartOpened++);
  h.context.initializeHeaderTooltips();
  const tooltip = h.tooltip(menu);
  menu.bounds.left = 360;
  menu.emit('focus');
  assert.equal(tooltip.dataset.open, 'true'); assert.equal(tooltip.dataset.input, 'focus');
  assert.equal(tooltip.style.getPropertyValue('--header-tooltip-left'), '322px');
  menu.setAttribute('aria-expanded', 'true'); h.sync();
  assert.equal(tooltip.textContent, '메뉴 닫기');
  assert.equal(menu.getAttribute('aria-label'), '메뉴 닫기');
  h.documentListeners.get('keydown')({ key: 'Escape' });
  assert.equal(tooltip.dataset.open, 'false');
  h.sync(); assert.equal(tooltip.dataset.open, 'false');
  menu.emit('blur'); menu.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(tooltip.dataset.input, 'pointer'); assert.equal(tooltip.dataset.open, 'true');
  menu.emit('pointerleave'); tooltip.emit('pointerenter'); h.flushTimers();
  assert.equal(tooltip.dataset.open, 'true');
  tooltip.emit('pointerleave'); h.flushTimers();
  assert.equal(tooltip.dataset.open, 'false');
  menu.visible = false; menu.emit('focus');
  assert.equal(tooltip.dataset.open, 'false');
  cart.emit('pointerenter', { pointerType: 'touch' });
  assert.equal(h.tooltip(cart).dataset.open, 'false');
  cart.emit('focus'); cart.emit('click');
  assert.equal(cartOpened, 1); assert.equal(h.tooltip(cart).dataset.open, 'false');
  cart.emit('blur'); cart.emit('focus'); h.windowListeners.get('resize')();
  assert.equal(h.tooltip(cart).dataset.open, 'false');
});
