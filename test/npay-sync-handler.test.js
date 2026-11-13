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
    assert.equal((await api.fetchNpaySync(new Request('https://example.invalid/api/orders?route=npay-sync',{method:'POST'}))).status,405);
  }finally{
    before.secret===undefined?delete process.env.NPAY_SYNC_SECRET:process.env.NPAY_SYNC_SECRET=before.secret;
    before.enabled===undefined?delete process.env.NPAY_ORDER_SYNC_ENABLED:process.env.NPAY_ORDER_SYNC_ENABLED=before.enabled;
  }
});
