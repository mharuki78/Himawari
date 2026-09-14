import test from 'node:test';
import assert from 'node:assert/strict';
import { assistant } from '../api/_lib/assistant.js';
import { guideFor, usefulAnswer } from '../api/_lib/assistant-guides.js';
const request=message=>new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://himawari.co.kr','content-type':'application/json'},body:JSON.stringify({message})});
test('wearing shortcut and paraphrases have actionable guidance',()=>{
 for(const q of ['편하게 메는 법','어깨끈이 흘러내려','가방 매는법']){
  const g=guideFor(q);assert.equal(g.id,'fit');assert.match(g.answer,/조절끈 끝/);assert.match(g.answer,/등 가까운/);
  assert.equal(usefulAnswer('관리자에게 문의해 주세요.',g),g.answer);
 }
 for(const q of ['소재 차이','지퍼가 뻑뻑해','가방 관리','노트북 인치','짐 정리','생활방수'])assert.ok(guideFor(q));
});
test('wearing shortcut bypasses catalog and remains useful during API failure',async()=>{
 const env={...process.env}, fetchBefore=globalThis.fetch;
 process.env.SUPPORT_AI_ENABLED='true';process.env.SUPPORT_AI_MODEL='test';process.env.OPENAI_API_KEY='test';process.env.PRODUCT_BLOB_READ_WRITE_TOKEN='must-not-be-used';
 let calls=0;
 globalThis.fetch=async(url)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls++;throw new Error('outage');};
 try{
  const result=await (await assistant(request('편하게 메는 법'))).json();assert.equal(result.mode,'guide');assert.match(result.answer,/조절끈 끝/);assert.equal(calls,1);
  globalThis.fetch=async(url,init)=>{assert.doesNotMatch(JSON.parse(init.body).instructions,/JSON 객체/);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'담당자에게 문의해 주세요.'}]}]});};
  const reply=await (await assistant(request('편하게 메는 법'))).json();assert.match(reply.answer,/양쪽 어깨끈/);
 }finally{globalThis.fetch=fetchBefore;for(const k of ['SUPPORT_AI_ENABLED','SUPPORT_AI_MODEL','OPENAI_API_KEY','PRODUCT_BLOB_READ_WRITE_TOKEN']){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}
});
