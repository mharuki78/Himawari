import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../api/_lib/npay-sandbox-checkout-sync.js').catch(error=>{
  if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;
  return {};
});
const checkoutId='00000000-0000-4000-8000-000000000001';
const productOrderId='2026111500000001';
const alias='NPR-0123456789abcdef01234567';
const args=()=>({checkoutId,productOrderIds:[productOrderId]});
const provider=(changes={})=>({data:[{order:{orderId:'2026111500000000',paymentDate:'2026-11-15T14:30:00+09:00',ordererName:'PRIVATE_FIXTURE_NAME'},
  shippingAddress:{baseAddress:'PRIVATE_FIXTURE_ADDRESS'},productOrder:{productOrderId,productId:alias,productOrderStatus:'PAYED',
    initialQuantity:1,remainQuantity:1,unitPrice:118000,optionPrice:0,...changes},completedClaims:[]}]});
const run=(...values)=>{assert.equal(typeof api.syncNpaySandboxCheckout,'function');return api.syncNpaySandboxCheckout(...values);};
const reservations=async()=>[{id:alias,environment:'sandbox'}];

test('sandbox checkout sync queries only supplied provider IDs and strips personal fields before reconciliation',async()=>{
  const calls=[];
  const result=await run({...args(),request:async(path,options)=>{calls.push({path,...options});return provider();}},
    {loadReservations:reservations,reconcile:async orders=>{
      assert.equal(orders.length,1);assert.equal(orders[0].productOrderId,productOrderId);
      assert.equal(orders[0].productId,alias);assert.equal(orders[0].unitPrice,118000);
      assert.doesNotMatch(JSON.stringify(orders),/PRIVATE_FIXTURE/);
      return{bound:1,updated:0,ignored:0,incidents:[]};
    }});
  assert.deepEqual(calls,[{path:'/v1/pay-order/mall/product-orders/query',method:'POST',body:{productOrderIds:[productOrderId]}}]);
  assert.deepEqual(result,{bound:1,updated:0,ignored:0,incidents:0,missing:0,changeCount:1,cursorAdvanced:false,collectionFinal:false,scope:'sandbox-checkout'});
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_FIXTURE|2026111500000001/);
});

test('foreign aliases and missing provider rows cannot change any reservation',async()=>{
  let writes=0;
  const deps={loadReservations:reservations,reconcile:async()=>{writes++;return{};}};
  for(const payload of [provider({productId:'NPR-abcdef0123456789abcdef01'}),{data:[]}]){
    await assert.rejects(run({...args(),request:async()=>payload},deps),{status:409});
  }
  assert.equal(writes,0);
});

test('invalid scope and non-sandbox checkout stop before provider access',async()=>{
  let calls=0;
  const request=async()=>{calls++;return provider();};
  for(const input of [{checkoutId:'wrong',productOrderIds:[productOrderId]},
    {checkoutId,productOrderIds:[]},{checkoutId,productOrderIds:[productOrderId,productOrderId]},
    {checkoutId,productOrderIds:['bad/id']},{checkoutId,productOrderIds:Array.from({length:51},(_,i)=>String(2026111500000000+i))}]){
    await assert.rejects(run({...input,request},{loadReservations:reservations}),{status:400});
  }
  await assert.rejects(run({...args(),request},{loadReservations:async()=>[]}),{status:404});
  await assert.rejects(run({...args(),request},{loadReservations:async()=>[{id:alias,environment:'production'}]}),{status:403});
  assert.equal(calls,0);
});
