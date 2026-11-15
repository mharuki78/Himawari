import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../api/_lib/npay-sync-handler.js').catch(()=>({}));
test('synchronization requires a server secret and explicit enabled environment before any order API access',async()=>{
  assert.equal(typeof api.fetchNpaySync,'function');
  const before={secret:process.env.NPAY_SYNC_SECRET,enabled:process.env.NPAY_ORDER_SYNC_ENABLED};
  const token='fixture-sync-secret-32-characters-long';
  process.env.NPAY_SYNC_SECRET=token;delete process.env.NPAY_ORDER_SYNC_ENABLED;
  try{
    const req=authorization=>new Request('https://example.invalid/api/orders?route=npay-sync',{headers:{authorization}});
    assert.equal((await api.fetchNpaySync(req('Bearer wrong'))).status,403);
    assert.equal((await api.fetchNpaySync(req('Bearer '+token))).status,503);
    assert.equal((await api.fetchNpaySync(new Request('https://example.invalid/api/orders?route=npay-sync',{method:'PUT'}))).status,405);
  }finally{
    before.secret===undefined?delete process.env.NPAY_SYNC_SECRET:process.env.NPAY_SYNC_SECRET=before.secret;
    before.enabled===undefined?delete process.env.NPAY_ORDER_SYNC_ENABLED:process.env.NPAY_ORDER_SYNC_ENABLED=before.enabled;
  }
});

test('scoped sandbox sync is denied on production before credentials, database or provider access',async()=>{
  const values={NPAY_SYNC_SECRET:process.env.NPAY_SYNC_SECRET,NPAY_ORDER_SYNC_ENABLED:process.env.NPAY_ORDER_SYNC_ENABLED,
    VERCEL_ENV:process.env.VERCEL_ENV,NPAY_ORDER_API_ENV:process.env.NPAY_ORDER_API_ENV};
  const token='fixture-sync-secret-32-characters-long';
  Object.assign(process.env,{NPAY_SYNC_SECRET:token,NPAY_ORDER_SYNC_ENABLED:'true',VERCEL_ENV:'production',NPAY_ORDER_API_ENV:'sandbox'});
  try{
    const request=new Request('https://example.invalid/api/orders?route=npay-sync',{method:'POST',headers:{authorization:'Bearer '+token,
      origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify({checkoutId:'00000000-0000-4000-8000-000000000001',productOrderIds:['2026111500000001']})});
    assert.equal((await api.fetchNpaySync(request)).status,403);
  }finally{for(const [name,value] of Object.entries(values))value===undefined?delete process.env[name]:process.env[name]=value;}
});

test('existing GET lease-conflict failures retain the original 502 response',async()=>{
  const replacements={NPAY_SYNC_SECRET:'fixture-sync-secret-32-characters-long',NPAY_ORDER_SYNC_ENABLED:'true',
    NPAY_ORDER_API_ENV:'sandbox',NPAY_ORDER_CLIENT_ID:'fixture',NPAY_ORDER_CLIENT_SECRET:'$2a$10$0123456789012345678901',
    NPAY_ORDER_PROXY_URL:'https://fixture:fixture@fixture.usefixie.com'};
  const previous=Object.fromEntries(Object.keys(replacements).map(key=>[key,process.env[key]]));
  Object.assign(process.env,replacements);
  try{
    const req=new Request('https://example.invalid/api/orders?route=npay-sync',{headers:{authorization:'Bearer '+replacements.NPAY_SYNC_SECRET}});
    const response=await api.fetchNpaySync(req,{runSync:async({environment})=>{
      assert.equal(environment,'sandbox');throw Object.assign(new Error('fixture lease conflict'),{status:409});
    }});
    assert.equal(response.status,502);
    assert.match(response.headers.get('cache-control'),/no-store/);
  }finally{for(const [key,value] of Object.entries(previous))value===undefined?delete process.env[key]:process.env[key]=value;}
});
