import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../api/_lib/npay-order-client.js').catch(() => ({}));
const setup = options => { assert.equal(typeof api.createNpayOrderClient,'function','authenticated mall transport missing'); return api.createNpayOrderClient(options); };
const settings = { environment:'sandbox',clientId:'aaaabbbbcccc',clientSecret:'$2a$10$abcdefghijklmnopqrstuv',proxyUrl:'http://fixture:fixture@fixture.usefixie.com:80' };

test('mall transport uses the official signing vector, proxy TLS and a shared token without forwarding private fields',async()=>{
  const calls=[];
  const client=setup({...settings,clock:()=>1643961623299,send:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/v1/oauth2/token')){
      const form=new URLSearchParams(options.body);
      assert.equal(form.get('client_secret_sign'),'JDJhJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dXVCVldZSk42T0VPdEx1OFY0cDQxa2IuTnpVaUEzbmsy');
      assert.equal(form.get('type'),'SELF');
      return {status:200,payload:{access_token:'fixture-token',expires_in:10800}};
    }
    assert.equal(options.headers.authorization,'Bearer fixture-token');
    return {status:200,payload:{data:{count:0,lastChangeStatuses:[]}}};
  }});
  try{
    await Promise.all([client.request('/v1/pay-order/mall/product-orders/last-changed-statuses?lastChangedFrom=fixture',{method:'GET'}),client.request('/v1/pay-order/mall/product-orders/query',{method:'POST',body:{productOrderIds:['fixture']}})]);
    assert.equal(calls.filter(c=>c.url.endsWith('/v1/oauth2/token')).length,1);
    assert.equal(calls.length,3);
    assert.ok(calls.every(c=>c.url.startsWith('https://sandbox-api.pay.naver.com/npay/partner/')));
    assert.ok(calls.every(c=>c.options.maxRedirections===0));
    assert.ok(calls.every(c=>c.options.proxyUrl.startsWith('https://')&&(new URL(c.options.proxyUrl).port||'443')==='443'));
  }finally{await client.close();}
});

test('mall transport rejects unexpected destinations, methods and exhausted request budget without network effects',async()=>{
  let calls=0;
  const client=setup({...settings,maxRequests:2,send:async()=>{calls++;return{status:200,payload:calls===1?{access_token:'fixture',expires_in:10800}:{data:[]}};}});
  try{
    await assert.rejects(client.request('https://evil.invalid/path',{method:'GET'}));
    await assert.rejects(client.request('/v1/pay-order/seller/product-orders/query',{method:'POST',body:{}}));
    await assert.rejects(client.request('/v1/pay-order/mall/product-orders/query',{method:'DELETE'}));
    assert.equal(calls,0);
    await client.request('/v1/pay-order/mall/product-orders/query',{method:'POST',body:{productOrderIds:[]}});
    await assert.rejects(client.request('/v1/pay-order/mall/product-orders/query',{method:'POST',body:{}}),{status:503});
    assert.equal(calls,2);
  }finally{await client.close();}
});

test('failed authentication does not retry or leak provider response, secrets, tokens or proxy credentials',async()=>{
  let calls=0;
  const client=setup({...settings,send:async()=>{calls++;return{status:401,payload:{message:'SYNTHETIC_PRIVATE_DATA'}};}});
  try{await assert.rejects(client.request('/v1/pay-order/mall/product-orders/query',{method:'POST',body:{}}),error=>{
    assert.equal(error.status,502);assert.doesNotMatch(error.message,/SYNTHETIC_PRIVATE|fixture|abcdefghijkl/);return true;
  });assert.equal(calls,1);}finally{await client.close();}
});
