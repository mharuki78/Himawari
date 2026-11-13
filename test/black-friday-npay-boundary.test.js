import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { purchaseQuantity } from '../assets/purchase-quantity.js';
import { webcrypto } from 'node:crypto';

test('member-style silent cart restoration hides Npay and stale callbacks read the actual sale cart',async()=>{
 const events=new Map(),storage=new Map(),requests=[],creations=[];
 const container={dataset:{}},status={textContent:'',classList:{toggle(){}}};
 const section={hidden:true,querySelector:s=>s==='[data-npay-cart]'?container:status};
 const document={readyState:'loading',addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},querySelector:s=>s==='[data-npay-cart-section]'?section:null};
 const context=vm.createContext({crypto:webcrypto,document,window:{addEventListener(){},Npay:{order:{create:async options=>creations.push(options)}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},setTimeout:()=>1,clearTimeout(){},navigator:{},location:{pathname:'/product.html',search:''},AbortController,purchaseQuantity,fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({enabled:true,buttonKey:'fixture'})};}});
 vm.runInContext(readFileSync(new URL('../assets/cart.js',import.meta.url),'utf8'),context);
 let source=readFileSync(new URL('../assets/npay.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 vm.runInContext(source,context);
 context.window.SiteCart.add('가방',59000,'','bag','','',5,1);
 await context.initializeNpay({cartItems:context.window.SiteCart.items()});
 assert.equal(section.hidden,false);assert.equal(creations.length,1);
 context.window.SiteCart.replace([{id:'bag',name:'가방',price:39000,q:1,stock:3,blackFriday:{offerId:'eb3ff32a-dce8-4c79-8dba-c93058eb6247',unitPrice:39000}}],false);
 assert.equal(section.hidden,true);
 const result=await creations[0].onBuyClick();
 assert.equal(result,null);assert.ok(!requests.some(r=>r.url==='/api/npay/order'));
 const sale=context.window.SiteCart.items()[0],normal={id:'normal',name:'일반 상품',price:50000,q:1,stock:5};
 context.window.SiteCart.replace([sale,normal],false);
 let selected=[normal];context.window.SiteCart.selectedItems=()=>selected;
 document.dispatchEvent(new context.CustomEvent('himawari:cart-state',{detail:{items:context.window.SiteCart.items()}}));
 assert.equal(section.hidden,false,'An excluded campaign must not block selected ordinary checkout');
 await creations[0].onBuyClick();
 const order=requests.find(r=>r.url==='/api/npay/order');
 assert.deepEqual(JSON.parse(order.options.body).items,[{productId:'normal',optionId:'',quantity:1}]);
 selected=[];const before=requests.filter(r=>r.url==='/api/npay/order').length;await creations[0].onBuyClick();
 assert.equal(requests.filter(r=>r.url==='/api/npay/order').length,before,'A stale callback must not purchase an empty selection');
});

function npayFixture({ enabled = true, campaign = true, checkout = false, uuid = webcrypto, storage = new Map(), holdOrders = false, pathname = '/checkout.html', review = false } = {}) {
 const requests=[],creations=[],releases=[];
 let publicConfig={enabled,blackFriday:{enabled:campaign},buttonKey:'fixture',review},items=[];
 const container={id:checkout?'npay-checkout-button':'npay-cart-button',dataset:{}},status={textContent:'',classList:{toggle(){}}};
 const section={hidden:true,querySelector:s=>s==='[data-npay-status]'?status:container};
 const document={addEventListener(){},querySelector:s=>s===(checkout?'[data-npay-checkout-section]':'[data-npay-cart-section]')?section:null};
 const context=vm.createContext({crypto:uuid,document,window:{SiteCart:{items:()=>items,selectedItems:()=>items},Npay:{order:{create:async options=>creations.push(options)}}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},location:{pathname,search:''},AbortController,purchaseQuantity,fetch:async(url,options)=>{requests.push({url,options});if(holdOrders&&url==='/api/npay/order')await new Promise(resolve=>releases.push(resolve));return{ok:true,json:async()=>url==='/api/npay/config'?publicConfig:{key:'fixture-order',merchantNo:'fixture-merchant'}};}});
 vm.runInContext(readFileSync(new URL('../assets/npay.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''),context);
 return {context,requests,creations,section,status,release:()=>releases.splice(0).forEach(resolve=>resolve()),setItems:value=>{items=value;},setConfig:value=>{publicConfig=value;},start:()=>checkout?context.initializeCheckoutNpay(()=>items):context.initializeNpay({cartItems:items}),orders:()=>requests.filter(r=>r.url==='/api/npay/order').map(r=>JSON.parse(r.options.body))};
}
const offerId='eb3ff32a-dce8-4c79-8dba-c93058eb6247';
const mixedCart=[{id:'sale',optionId:'blue',q:2,blackFriday:{offerId,unitPrice:39000}},{id:'normal',optionId:'',q:3}];
const mixedCheckout=[{productId:'sale',optionId:'blue',quantity:2,blackFriday:{offerId,unitPrice:39000}},{productId:'normal',optionId:'',quantity:3}];

test('explicit campaign capability preserves mixed cart metadata and stable intent IDs across retries',async()=>{
 const page=npayFixture();page.setItems(mixedCart);await page.start();
 assert.equal(page.section.hidden,false);assert.equal(page.creations.length,1);
 const click=page.creations[0].onBuyClick;
 await Promise.all([click(),click()]);
 assert.equal(page.orders().length,1,'Concurrent identical intents share one registration');
 assert.deepEqual(page.orders()[0].items,mixedCheckout);
 assert.match(page.orders()[0].requestId,/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
 await click();assert.equal(page.orders()[1].requestId,page.orders()[0].requestId);
 page.setItems([{...mixedCart[0],q:1},mixedCart[1]]);await click();
 assert.notEqual(page.orders()[2].requestId,page.orders()[0].requestId);
});

test('checkout independently gates campaign initialization and rechecks a stale callback',async()=>{
 for(const campaign of [false,true]) {
  const page=npayFixture({checkout:true,campaign});page.setItems(mixedCheckout);await page.start();
  assert.equal(page.creations.length,campaign?1:0);
  if(!campaign)continue;
  await page.creations[0].onBuyClick();assert.deepEqual(page.orders()[0].items,mixedCheckout);
  page.setConfig({enabled:true,blackFriday:{enabled:false}});
  assert.equal(await page.creations[0].onBuyClick(),null);assert.equal(page.orders().length,1);
 }
});

test('a cart callback rechecks campaign config and fails closed if UUID support is unavailable',async()=>{
 const page=npayFixture();page.setItems(mixedCart);await page.start();
 page.setConfig({enabled:false,blackFriday:{enabled:true}});
 assert.equal(await page.creations[0].onBuyClick(),null);assert.equal(page.orders().length,0);
 assert.equal(page.section.hidden,true,'Revoked campaign capability hides the cart Npay section');
 const missing=npayFixture({uuid:null});missing.setItems(mixedCart);await missing.start();
 assert.equal(await missing.creations[0].onBuyClick(),null);assert.equal(missing.orders().length,0);
});

test('ordinary checkout callback cannot enable campaign intent with its old ordinary config',async()=>{
 const page=npayFixture({checkout:true,campaign:false});page.setItems([mixedCheckout[1]]);await page.start();
 assert.equal(page.creations.length,1);
 page.setItems(mixedCheckout);assert.equal(await page.creations[0].onBuyClick(),null);
 assert.equal(page.orders().length,0);
});

test('concurrent changed intent registers its own payload and request identity',async()=>{
 const page=npayFixture({holdOrders:true});page.setItems(mixedCart);await page.start();
 const first=page.creations[0].onBuyClick();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(page.orders().length,1);
 page.setItems([{...mixedCart[0],q:1},mixedCart[1]]);
 const second=page.creations[0].onBuyClick();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(page.orders().length,2);
 assert.equal(page.orders()[0].items[0].quantity,2);assert.equal(page.orders()[1].items[0].quantity,1);
 assert.notEqual(page.orders()[0].requestId,page.orders()[1].requestId);
 page.release();await Promise.all([first,second]);
});

test('the same public product intent reuses its UUID after module reload',async()=>{
 const storage=new Map(),first=npayFixture({storage});first.setItems(mixedCart);await first.start();await first.creations[0].onBuyClick();
 const next=npayFixture({storage});next.setItems(mixedCart);await next.start();await next.creations[0].onBuyClick();
 assert.equal(next.orders()[0].requestId,first.orders()[0].requestId);
 assert.deepEqual(Object.keys(JSON.parse(storage.get('himawari-npay-intent-v1'))).sort(),['createdAt','fingerprint','requestId']);
});

test('a stale checkout callback cannot register an empty or expired checkout',async()=>{
 const page=npayFixture({checkout:true});page.setItems(mixedCheckout);await page.start();page.setItems([]);
 assert.equal(await page.creations[0].onBuyClick(),null);assert.equal(page.orders().length,0);
});

test('review capability permits private sandbox checkout and stays blocked on public checkout',async()=>{
 for(const pathname of ['/npay-sandbox-checkout.html','/checkout.html']) {
  const page=npayFixture({checkout:true,review:true,pathname});page.setItems(mixedCheckout);await page.start();
  assert.equal(page.creations.length,pathname==='/checkout.html'?0:1);
  if(page.creations.length){await page.creations[0].onBuyClick();assert.deepEqual(page.orders()[0].items,mixedCheckout);}
 }
});
