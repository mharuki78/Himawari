import assert from 'node:assert/strict';
import test from 'node:test';
const api=await import('../api/_lib/npay-sync-policy.js').catch(()=>({}));
test('six daily collections have a bounded transport budget and a five-hour freshness limit',()=>{
  assert.equal(typeof api.npaySyncPolicy,'function');
  assert.deepEqual(api.npaySyncPolicy({NPAY_SYNC_CADENCE:'4h'}),{cadence:'4h',maxAgeMs:5*3600_000,maxRequests:10});
  assert.deepEqual(api.npaySyncPolicy({}),{cadence:'5m',maxAgeMs:600_000,maxRequests:20});
  for(const value of ['','240','24h','never','4H'])assert.equal(api.npaySyncPolicy({NPAY_SYNC_CADENCE:value}),null);
});
