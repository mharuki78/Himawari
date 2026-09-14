import test from 'node:test';
import assert from 'node:assert/strict';
import { assistant } from '../api/_lib/assistant.js';
const req=(message,aiConsent)=>new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://himawari.co.kr','content-type':'application/json'},body:JSON.stringify({message,aiConsent})});
test('AI requires opt-in, sends only current question, and falls back safely',async()=>{
 const before={...process.env}; const original=globalThis.fetch;let calls=0;
 process.env.SUPPORT_AI_ENABLED='true';process.env.SUPPORT_AI_MODEL='gpt-4.1-mini';process.env.OPENAI_API_KEY='test-only';
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.input,'배송비 알려줘');assert.ok(b.max_output_tokens<=500);assert.equal(b.previous_response_id,undefined);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'배송비는 3,500원입니다.'}]}]});};
 try {
  assert.equal((await (await assistant(req('배송비 알려줘',false))).json()).mode,'guide');assert.equal(calls,0);
  assert.equal((await (await assistant(req('배송비 알려줘',true))).json()).mode,'ai');assert.equal(calls,1);
  await assistant(req('배송비 test@example.com',true));await assistant(req('주문번호 HMW-123 배송비',true));await assistant(req('내 배송 조회',true));assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('',{status:429});assert.equal((await (await assistant(req('배송비 알려줘',true))).json()).mode,'guide');
 } finally {globalThis.fetch=original;for(const k of ['SUPPORT_AI_ENABLED','SUPPORT_AI_MODEL','OPENAI_API_KEY']) {if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}
});
