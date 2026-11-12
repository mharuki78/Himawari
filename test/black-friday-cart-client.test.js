import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { checkoutCartLine, checkoutItemsInput, removePurchasedCartItems, mergeRemainingCart } from '../assets/black-friday-cart.js';

const offerId='eb3ff32a-dce8-4c79-8dba-c93058eb6247';
const selection={offerId,unitPrice:39000};
const product={id:'bag',name:'가방',price:59000,stock:5,options:[]};
const event={state:'open',endsAt:'2099-01-01T00:00:00Z',serverTime:'2026-11-12T00:00:00Z',items:[{productId:'bag',optionId:'',optionLabel:'',offerId,price:39000,remaining:3}]};
const line={productId:'bag',optionId:'',quantity:2,blackFriday:selection};

test('checkout resolves each sale line at its locked offer price and rejects stale/depleted/expired contexts',()=>{
 const sale=checkoutCartLine(line,product,event);
 assert.equal(sale.product.price,39000);assert.equal(sale.stock,3);assert.deepEqual(sale.blackFriday,selection);
 assert.deepEqual(checkoutItemsInput([sale]),[line]);
 assert.equal(checkoutCartLine({...line,blackFriday:undefined},product,event).product.price,59000);
 assert.throws(()=>checkoutCartLine({...line,optionId:'phantom',blackFriday:undefined},product,event));
 for(const bad of [{...line,blackFriday:{...selection,unitPrice:1}},{...line,quantity:4},{...line,blackFriday:{offerId:'invalid',unitPrice:39000}}])assert.throws(()=>checkoutCartLine(bad,product,event));
 assert.throws(()=>checkoutCartLine(line,product,{...event,state:'closed'}));
 assert.throws(()=>checkoutCartLine(line,product,{...event,serverTime:event.endsAt}));
});

test('completed purchases subtract only the same purchase context and preserve other items and newly added quantities',()=>{
 const current=[{id:'bag',optionId:'',q:3,blackFriday:selection},{id:'other',q:1},{id:'changed',q:2,blackFriday:{...selection,unitPrice:38000}}];
 const remaining=removePurchasedCartItems(current,[line,{productId:'changed',quantity:1,blackFriday:selection}]);
 assert.equal(remaining[0].q,1);assert.equal(remaining[1].q,1);assert.equal(remaining[2].q,2);
 assert.equal(removePurchasedCartItems([{productId:'bag',quantity:2,blackFriday:selection}],[line]).length,0);
 const merged=mergeRemainingCart([{id:'local-only',name:'local',q:1,price:1000}], [{productId:'remote-only',quantity:2,product:{name:'remote',price:2000}}]);
 assert.equal(merged.length,2);assert.equal(merged.find(item=>item.id==='remote-only').q,2);
 const upgraded=mergeRemainingCart([{id:'bag',name:'가방',q:1,price:59000}], [{productId:'bag',quantity:1,stock:3,blackFriday:selection,product:{name:'가방',price:39000}}]);
 assert.deepEqual(upgraded[0].blackFriday,selection);assert.equal(upgraded[0].price,39000);
});

function cartSandbox(stored){
 const storage=new Map(stored?[['site-cart',JSON.stringify(stored)]]:[]);
 const context=vm.createContext({document:{readyState:'loading',addEventListener(){},dispatchEvent(){}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{},setTimeout(){},navigator:{}});
 vm.runInContext(readFileSync(new URL('../assets/cart.js',import.meta.url),'utf8'),context);
 return {cart:context.window.SiteCart,storage};
}

test('cart retains sale metadata across add, persistence and member-style replace, with one SKU and strict quota',()=>{
 const h=cartSandbox();assert.equal(h.cart.add('가방',39000,'','bag','','',3,1,selection),true);
 assert.deepEqual(JSON.parse(JSON.stringify(h.cart.items()[0].blackFriday)),selection);
 const restored=cartSandbox(JSON.parse(h.storage.get('site-cart')));
 restored.cart.add('가방',59000,'','bag','','',5,1);
 assert.equal(restored.cart.items().length,1);assert.equal(restored.cart.items()[0].price,39000);assert.equal(restored.cart.items()[0].q,2);
 restored.cart.replace(restored.cart.items());assert.equal(restored.cart.items()[0].blackFriday.offerId,offerId);
 assert.equal(restored.cart.add('가방',59000,'','bag','','',5,2),false);
 assert.equal(restored.cart.items()[0].q,2);
 const regular=cartSandbox([{id:'bag',name:'가방',price:59000,q:1,stock:5}]);
 assert.equal(regular.cart.add('가방',39000,'','bag','','',3,1,selection),true);
 assert.equal(regular.cart.items()[0].price,39000);assert.equal(regular.cart.items()[0].q,2);
});
