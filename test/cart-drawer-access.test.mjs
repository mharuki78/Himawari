import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/cart.js', import.meta.url), 'utf8');

function setup({ stored = null, fetch, now = Date.now, setTimer = () => {} } = {}) {
  const documentListeners = new Map();
  const document = { readyState: 'complete', activeElement: null };
  function node() {
    const attributes = new Map(), queries = new Map();
    const element = {
      listeners: {},
      className: '', inert: false, dataset: {}, children: [], disabled: false, offsetWidth: 44, offsetHeight: 44,
      setAttribute(key, value) { attributes.set(key, String(value)); },
      getAttribute(key) { return attributes.get(key) ?? null; },
      removeAttribute(key) { attributes.delete(key); },
      appendChild(child) { this.children.push(child); },
      addEventListener(name, handler) { this.listeners[name] = handler; },
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
  const context = vm.createContext({ document, window: { addEventListener() {} }, localStorage: { getItem: () => stored ? JSON.stringify(stored) : null, setItem() {} }, CustomEvent: class {}, setTimeout: setTimer, clearTimeout() {}, Date: class extends Date { static now() { return now(); } }, navigator: {}, fetch, URL, AbortController });
  vm.runInContext(source, context);
  const drawer = document.querySelector('.rdcart');
  const panel = drawer.querySelector('.rdcart__panel');
  const close = drawer.querySelector('.rdcart__close');
  const last = node();
  panel.focusTargets = [close, last];
  return { document, documentListeners, page, preserved, drawer, close, last, body: drawer.querySelector('.rdcart__body'), cart: context.window.SiteCart };
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

test('existing saved carts receive canonical photos and only active offers show original price, sale price and discount', async () => {
  const offerId='eb3ff32a-dce8-4c79-8dba-c93058eb6247';
  const stored=[{id:'sale',name:'행사 가방',price:39000,q:2,stock:4,optionId:'',blackFriday:{offerId,unitPrice:39000}},{id:'regular',name:'일반 가방',price:50000,q:1,stock:3}];
  let state='open';
  const h=setup({stored,fetch:async url=>({ok:true,json:async()=>url==='/api/products'?{products:[{id:'sale',image:'https://images.example/sale.webp',price:59000},{id:'regular',image:'https://images.example/regular.webp',price:50000}]}:{state,endsAt:'2099-01-01T00:00:00Z',items:state==='open'?[{productId:'sale',optionId:'',offerId,price:39000,regularPrice:59000,image:'https://images.example/sale.webp',remaining:4}]:[]}})});
  h.cart.open();await new Promise(setImmediate);
  assert.match(h.body.innerHTML, /src="https:\/\/images.example\/sale.webp"/);
  assert.match(h.body.innerHTML, /src="https:\/\/images.example\/regular.webp"/);
  assert.equal((h.body.innerHTML.match(/<del /g)||[]).length,1);
  assert.match(h.body.innerHTML,/59,000원/);assert.match(h.body.innerHTML,/39,000원/);assert.match(h.body.innerHTML,/34% 할인/);
  assert.equal(h.cart.items()[0].price,39000);assert.equal(h.cart.items()[0].q,2);
  state='closed';h.cart.close();h.cart.open();await new Promise(setImmediate);
  assert.doesNotMatch(h.body.innerHTML,/<del |34% 할인/);
  assert.equal(h.cart.items()[0].blackFridayUnavailable,true);
});

test('an open drawer removes expired sale prices and discount metadata without another interaction', async () => {
  const offerId='eb3ff32a-dce8-4c79-8dba-c93058eb6247';
  let clock=Date.now(),timer;
  const endsAt=new Date(clock+10000).toISOString();
  const h=setup({stored:[{id:'sale',name:'행사 가방',price:39000,q:1,stock:4,blackFriday:{offerId,unitPrice:39000}}],now:()=>clock,setTimer:callback=>{timer=callback;return 1;},fetch:async url=>({ok:true,json:async()=>url==='/api/products'?{products:[]}:{state:'open',endsAt,items:[{productId:'sale',optionId:'',offerId,price:39000,regularPrice:59000,remaining:4}]}})});
  h.cart.open();await new Promise(setImmediate);
  assert.match(h.body.innerHTML,/34% 할인/);
  clock+=11000;
  assert.equal(typeof timer,'function');timer();
  assert.doesNotMatch(h.body.innerHTML,/<del |34% 할인|39,000원/);
  assert.equal(h.cart.items()[0].blackFridayUnavailable,true);
  assert.equal(h.cart.items()[0].blackFriday.unitPrice,39000);
});

test('cart selection controls selected checkout input while retaining the full silently restored cart', () => {
  const h=setup({stored:[{id:'a',name:'가방 A',price:49000,q:1,stock:3},{id:'b',name:'가방 B',price:39000,q:1,stock:4}]});
  assert.equal(h.cart.selectedItems().length,2);
  const checkbox={checked:false,getAttribute:name=>name==='data-rdcart-select'?'0':null,closest(){return this;}};
  h.drawer.listeners.change({target:checkbox});
  assert.equal(h.cart.items().length,2);assert.equal(h.cart.selectedItems().length,1);assert.equal(h.cart.selectedItems()[0].id,'b');
  h.cart.replace(h.cart.items(),false);assert.equal(h.cart.selectedItems().length,1);
  checkbox.checked=true;h.drawer.listeners.change({target:checkbox});assert.equal(h.cart.selectedItems().length,2);
});

const clickAction = (h,name,value='') => h.drawer.listeners.click({target:{closest(){return this;},hasAttribute:key=>key===name,getAttribute:key=>key===name?value:null}});
const variantProducts=[{id:'blue',name:'No.1027 블루',model:'No.1027',price:59000,stock:4},{id:'pink',name:'No.1027 핑크',model:'No.1027',price:61000,stock:3}];
test('cancel during a pending option apply prevents any later mutation',async()=>{
 let deferred=false;const releases=[];
 const h=setup({stored:[{id:'blue',name:'No.1027 블루',price:59000,q:1,stock:4}],fetch:async url=>{
   if(deferred)await new Promise(resolve=>releases.push(resolve));
   return {ok:true,json:async()=>url==='/api/products'?{products:variantProducts}:{state:'closed',items:[]}};
 }});
 clickAction(h,'data-rdcart-options','0');await new Promise(setImmediate);
 h.drawer.querySelector('[data-rdcart-choice]').value='1';deferred=true;
 clickAction(h,'data-rdcart-apply-option');clickAction(h,'data-rdcart-cancel-option');
 releases.forEach(resolve=>resolve());await new Promise(setImmediate);
 assert.equal(h.cart.items()[0].id,'blue');assert.equal(h.drawer.querySelector('.rdcart__editor').hidden,true);
});
test('a hanging option request times out and restores selected checkout',async()=>{
 let timeout;
 const h=setup({stored:[{id:'blue',name:'No.1027 블루',price:59000,q:1,stock:4}],fetch:async()=>new Promise(()=>{}),setTimer:callback=>{timeout=callback;return 1;}});
 clickAction(h,'data-rdcart-options','0');assert.equal(h.drawer.querySelector('.rdcart__checkout').disabled,true);
 assert.equal(typeof timeout,'function');timeout();await new Promise(setImmediate);
 assert.equal(h.drawer.querySelector('.rdcart__checkout').disabled,false);
 assert.match(h.drawer.querySelector('.rdcart__status').textContent,/다시/);
});
