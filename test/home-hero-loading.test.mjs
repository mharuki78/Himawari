import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getHomeHeroSelection } from '../assets/home-colours.js';

const source = readFileSync(new URL('../assets/site-ui.source.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace("import('/products.js')", 'catalogModule()');
const products = [
  { id: 'black-9007', name: 'Himawari No.9007 블랙', model: 'No.9007', image: 'https://example.com/9007-black.jpg' },
  { id: 'pink-9007', name: 'Himawari No.9007 핑크', model: 'No.9007', image: 'https://example.com/9007-pink.jpg' },
  { id: 'blue-9007', name: 'Himawari No.9007 블루', model: 'No.9007', image: 'https://example.com/9007-blue.jpg' },
];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('early bootstrap recovers a failed bundle even when head resources delay body parsing', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bootstrap = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  let hero, deadline, onParsed, reloads = 0;
  const retry = { hidden: true, addEventListener(type, callback) { this.click = callback; } };
  const label = {}, status = {};
  const document = {
    documentElement: { classList: { add() {} } },
    querySelector() { return hero; },
    addEventListener(type, callback) { assert.equal(type, 'DOMContentLoaded'); onParsed = callback; },
  };
  vm.runInNewContext(bootstrap, { document, location: { hash: '#test', reload() { reloads++; } }, setTimeout(callback) { deadline = callback; } });
  deadline();
  assert.equal(typeof onParsed, 'function');
  hero = { dataset: {}, querySelector(selector) { return selector.includes('placeholder') ? label : selector.includes('status') ? status : retry; } };
  onParsed();
  assert.equal(hero.dataset.colourState, 'error');
  assert.equal(retry.hidden, false);
  assert.match(label.textContent, /불러오지 못했습니다/);
  retry.click();
  assert.equal(reloads, 1);
  // A working controller owns its own request/image deadlines.
  hero.dataset.colourController = 'ready'; hero.dataset.colourState = 'ready';
  onParsed();
  assert.equal(hero.dataset.colourState, 'ready');
});

// Only browser and network boundaries are doubled; the entire hero controller
// and its real catalogue selection helper run for each isolated document.
function setup({ catalogue = () => Promise.resolve(products), reducedMotion = false } = {}) {
  function element() {
    return {
      dataset: {}, style: { setProperty(key, value) { this[key] = value; } }, children: [],
      attributes: new Map(), listeners: new Map(), textContent: '', hidden: false,
      setAttribute(key, value) { this.attributes.set(key, String(value)); },
      getAttribute(key) { return this.attributes.get(key) ?? null; },
      getAttributeNames() { return [...this.attributes.keys()]; },
      removeAttribute(key) { this.attributes.delete(key); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      querySelector(selector) {
        if (selector === 'span') return this.children[0];
        if (selector === '[aria-pressed="true"]') return this.children.find(child => child.getAttribute('aria-pressed') === 'true');
        return null;
      },
      querySelectorAll(selector) { return selector === 'button' ? this.children : []; },
      click() { return this.listeners.get('click')?.({ detail: 1 }); },
    };
  }
  const root = element(), picker = element(), panel = element(), status = element(), retry = element();
  let photo = element();
  const model = element(), label = element(), captionLabel = element(), caption = element(), detail = element(), placeholderLabel = element();
  const nodes = new Map(Object.entries({ picker, photo, panel, status, retry, model, 'model-caption': caption, detail, 'placeholder-label': placeholderLabel })
    .map(([name, node]) => [`[data-colour-${name}]`, node]));
  function replacePhoto(replacement) { photo = replacement; nodes.set('[data-colour-photo]', replacement); }
  photo.replaceWith = replacePhoto;
  root.dataset.colourState = 'loading';
  root.querySelector = selector => selector === '.colour-selection strong' ? label : selector === '[data-colour-detail] span' ? detail.children[0] : nodes.get(selector);
  root.querySelectorAll = selector => selector === '[data-colour-label]' ? [label, captionLabel] : [];
  picker.hidden = true; retry.hidden = true; photo.src = '/assets/home/0422-mint.jpg'; model.textContent = 'No.0422'; label.textContent = '민트';
  detail.href = '/products.html'; detail.append(Object.assign(element(), { textContent: '전체 가방 보기' }));
  const pageListeners = new Map(), motionListeners = new Map(), stored = [], images = [], animations = [], timers = new Map();
  const motion = { matches: reducedMotion, addEventListener: (name, fn) => motionListeners.set(name, fn), removeEventListener: name => motionListeners.delete(name) };
  const snapshot = () => ({
    state: root.dataset.colourState, image: photo.src, model: model.textContent, label: label.textContent,
    caption: caption.textContent, href: detail.href, pressed: picker.querySelector('[aria-pressed="true"]')?.dataset.colourId,
    pickerHidden: picker.hidden, tint: panel.style.backgroundColor,
  });
  const commits = [];
  root.dataset = new Proxy(root.dataset, { set(target, key, value) { target[key] = value; if (key === 'colourState' && value === 'ready') commits.push(snapshot()); return true; } });
  const context = vm.createContext({
    document: { querySelector: () => root, createElement: element },
    getHomeHeroSelection: (items, options) => getHomeHeroSelection(items, { ...options, random: () => 0 }),
    catalogModule: async () => ({ getCatalogProducts: catalogue }),
    matchMedia: () => motion,
    addEventListener: (name, fn) => pageListeners.set(name, fn), removeEventListener: name => pageListeners.delete(name),
    localStorage: { getItem: () => '', setItem: (...entry) => stored.push(entry) },
    Image: class { constructor() { Object.assign(this, element()); this.replaceWith = replacePhoto; this.result = deferred(); images.push(this); } decode() { return this.result.promise; } },
    animate: (...args) => { const animation = { args, reverted: false, revert() { this.reverted = true; } }; animations.push(animation); return animation; },
    setTimeout: callback => { const timer = Symbol(); timers.set(timer, callback); return timer; }, clearTimeout: timer => timers.delete(timer),
  });
  vm.runInContext(source, context);
  return { root, picker, get photo() { return photo; }, panel, status, retry, model, label, caption, detail, placeholderLabel, images, stored, animations, commits, motionListeners, snapshot,
    page: (name, persisted = true) => pageListeners.get(name)?.({ persisted }),
    expire: () => { for (const callback of [...timers.values()]) callback(); },
  };
}

test('waiting for catalogue and first decoded image exposes no uncommitted colour choices', async () => {
  const catalogue = deferred(), h = setup({ catalogue: () => catalogue.promise });
  assert.equal(h.root.dataset.colourState, 'loading');
  assert.equal(h.panel.getAttribute('aria-busy'), 'true');
  assert.equal(h.detail.href, '/products.html');
  catalogue.resolve(products); await settle();
  assert.equal(h.images.length, 1);
  assert.equal(h.picker.hidden, true);
  assert.equal(h.picker.children.length, 0);
  assert.equal(h.root.dataset.colourState, 'loading');
  h.images[0].result.resolve(); await settle();
  assert.deepEqual(h.commits, [{ state: 'ready', image: 'https://example.com/9007-black.jpg', model: 'No.9007', label: '블랙', caption: 'Himawari No.9007 · 공식 제품 이미지', href: '/product.html?id=black-9007', pressed: 'black-9007', pickerHidden: false, tint: '#f2f3f3' }]);
  assert.equal(h.picker.getAttribute('aria-label'), 'No.9007 색상 선택');
  assert.equal(h.panel.getAttribute('aria-busy'), null);
  assert.deepEqual(h.stored, [['himawari-home-last-model', '9007']]);
});

test('the revealed photo is the decoded image element, so fallback pixels cannot remain during a source update', async () => {
  const h = setup(), fallback = h.photo; await settle();
  h.images[0].result.resolve(); await settle();
  assert.notEqual(h.photo, fallback);
  assert.equal(h.photo, h.images[0]);
  assert.equal(h.photo.alt, 'Himawari No.9007 블랙 공식 제품 이미지');
});

test('first image failure stays neutral and retry can commit a matching catalogue product', async () => {
  const h = setup(); await settle(); h.images[0].result.reject(new Error('image failed')); await settle();
  assert.equal(h.root.dataset.colourState, 'error');
  assert.equal(h.retry.hidden, false);
  assert.equal(h.detail.href, '/products.html');
  assert.equal(h.picker.hidden, true);
  assert.equal(h.picker.children.length, 0);
  assert.equal(h.panel.getAttribute('aria-busy'), null);
  assert.doesNotMatch(h.status.textContent, /현재 선택을 유지/);
  h.retry.click(); await settle(); h.images[1].result.resolve(); await settle();
  assert.equal(h.root.dataset.colourState, 'ready');
  assert.equal(h.retry.hidden, true);
  assert.equal(h.photo.src, 'https://example.com/9007-black.jpg');
});

test('catalogue errors and empty catalogues leave a retry and useful catalogue route', async () => {
  for (const catalogue of [() => Promise.reject(new Error('offline')), () => Promise.resolve([])]) {
    const h = setup({ catalogue }); await settle();
    assert.equal(h.root.dataset.colourState, 'error');
    assert.equal(h.retry.hidden, false);
    assert.equal(h.detail.href, '/products.html');
    assert.equal(h.picker.hidden, true);
    assert.equal(h.panel.getAttribute('aria-busy'), null);
    assert.match(h.status.textContent, /전체 가방/);
  }
});

test('a stalled initial request exits loading and a late response cannot reveal an old selection', async () => {
  const catalogue = deferred(), h = setup({ catalogue: () => catalogue.promise }); await settle();
  h.expire(); await settle();
  assert.equal(h.root.dataset.colourState, 'error');
  assert.equal(h.retry.hidden, false);
  catalogue.resolve(products); await settle();
  assert.equal(h.root.dataset.colourState, 'error');
  assert.equal(h.images.length, 0);
});

test('a stalled first image exits loading and cannot commit after its deadline', async () => {
  const h = setup(); await settle(); h.expire(); await settle();
  assert.equal(h.root.dataset.colourState, 'error');
  assert.equal(h.retry.hidden, false);
  h.images[0].result.resolve(); await settle();
  assert.equal(h.root.dataset.colourState, 'error');
  assert.equal(h.commits.length, 0);
});

test('later failed colour changes preserve the complete visible selection', async () => {
  const h = setup(); await settle(); h.images[0].result.resolve(); await settle();
  const before = h.snapshot();
  h.picker.children[1].click(); await settle();
  assert.deepEqual(h.snapshot(), before);
  h.images[1].result.reject(new Error('later image failed')); await settle();
  assert.deepEqual(h.snapshot(), before);
  assert.equal(h.panel.getAttribute('aria-busy'), null);
  assert.match(h.status.textContent, /현재 선택을 유지/);
});

test('rapid colour changes commit only the newest decoded product', async () => {
  const h = setup(); await settle(); h.images[0].result.resolve(); await settle();
  h.picker.children[1].click(); h.picker.children[2].click(); await settle();
  h.images[2].result.resolve(); await settle(); h.images[1].result.resolve(); await settle();
  assert.equal(h.photo.src, 'https://example.com/9007-blue.jpg');
  assert.equal(h.detail.href, '/product.html?id=blue-9007');
  assert.equal(h.picker.querySelector('[aria-pressed="true"]').dataset.colourId, 'blue-9007');
});

test('back-forward cache resumes an uncommitted load and preserves a committed selection and handlers', async () => {
  const h = setup({ reducedMotion: true }); await settle();
  h.page('pagehide'); h.images[0].result.resolve(); await settle(); h.page('pageshow'); await settle();
  assert.equal(h.images.length, 2);
  h.images[1].result.resolve(); await settle();
  assert.equal(h.root.dataset.colourState, 'ready');
  assert.equal(h.animations.length, 0);
  const before = h.snapshot();
  h.picker.children[1].click(); await settle(); h.page('pagehide'); h.page('pageshow');
  h.images[2].result.resolve(); await settle();
  assert.deepEqual(h.snapshot(), before);
  assert.equal(h.panel.getAttribute('aria-busy'), null);
  h.picker.children[2].click(); await settle(); h.images[3].result.resolve(); await settle();
  assert.equal(h.photo.src, 'https://example.com/9007-blue.jpg');
  assert.equal(h.motionListeners.has('change'), true);
});
