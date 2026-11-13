import assert from 'node:assert/strict';
import test from 'node:test';
const api=await import('../api/_lib/npay-readiness.js').catch(()=>({}));
const evaluate=(...args)=>{assert.equal(typeof api.evaluateNpayReadiness,'function');return api.evaluateNpayReadiness(...args);};
const now=Date.parse('2026-11-13T08:00:00Z');
const proof={enabled:true,sandbox_verified_at:new Date(now-10000),provider_approved_at:new Date(now-10000),cutover_verified_at:new Date(now-10000),polling_capacity_verified_at:new Date(now-10000)};
const sync={last_success_at:new Date(now-1000),through_at:new Date(now-1000),incident_count:0};
const settings={configured:true,environment:'production',now};
test('production readiness requires independent provider, cutover, capacity and fresh successful synchronization evidence',()=>{
  assert.equal(evaluate(proof,sync,settings).enabled,true);
  for(const key of ['sandbox_verified_at','provider_approved_at','cutover_verified_at','polling_capacity_verified_at'])assert.equal(evaluate({...proof,[key]:null},sync,settings).enabled,false);
  assert.equal(evaluate(proof,{...sync,incident_count:1},settings).enabled,false);
  assert.equal(evaluate(proof,{...sync,last_success_at:new Date(now-601000)},settings).enabled,false);
  assert.equal(evaluate(proof,{...sync,through_at:new Date(now-601000)},settings).enabled,false);
  assert.equal(evaluate(proof,sync,{...settings,configured:false}).enabled,false);
  assert.equal(evaluate(proof,sync,{...settings,now:now-100000}).enabled,false);
});
test('sandbox test capability is isolated from public production activation and disabled by default',()=>{
  assert.equal(evaluate(null,null,settings).enabled,false);
  const sandbox={sandbox_testing:true};
  assert.equal(evaluate(sandbox,null,{configured:true,environment:'sandbox',review:true,now}).enabled,true);
  assert.equal(evaluate(sandbox,null,{...settings,review:true}).enabled,false);
  assert.equal(evaluate(sandbox,null,{configured:true,environment:'sandbox',review:false,now}).enabled,false);
});
