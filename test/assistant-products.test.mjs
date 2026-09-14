import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseCandidates, productHistory, productCards, loadProductContext } from '../api/_lib/assistant-products.js';
import { seedCatalog } from '../api/_lib/products.js';
import { assistant } from '../api/_lib/assistant.js';
const products=seedCatalog().products;
test('office and parenting intents retrieve different actual product models',()=>{
 const office=chooseCandidates(products,'30대 남자 직장인인데 가방추천해줘');
 const parenting=chooseCandidates(products,'아기 기저귀와 유모차에 쓸 가방 추천');
 assert.match(office[0].name,/1884/);assert.match(parenting[0].name,/기저귀/);
 assert.notEqual(office[0].id,parenting[0].id);
});
test('budget, model specificity, and sold-out exclusion are respected',()=>{
 const selected=chooseCandidates([...products,{id:'sold',name:'남성 출근 가방',price:10,soldOut:true}],'남자 출근 10만원 이하');
 assert.ok(selected.every(p=>p.price<=100000&&p.id!=='sold'));
 assert.match(chooseCandidates(products,'0422 관리 방법')[0].name,/0422/);
 assert.deepEqual(chooseCandidates([{id:'none',name:'백팩',price:50000}],'1만원 이하'),[]);
});
test('cards use catalog values and never untrusted model URLs or prices',()=>{
 const p=products[0], context={candidates:[p],current:true};
 assert.deepEqual(productCards(['fake'],context),[]);
 const cards=productCards([p.id,p.id],context);assert.equal(cards.length,1);
 assert.equal(cards[0].price,p.price);assert.equal(cards[0].url,'/product.html?id='+p.id);
 assert.equal(productCards([p.id],{...context,current:false})[0].price,null);
});
test('follow-up context excludes private and order data and stays bounded',()=>{
 assert.deepEqual(productHistory(['가방 추천','test@example.com','주문번호 HMW-111','작은 건?']),['작은 건?']);
 assert.equal(productHistory(Array(8).fill('출근 가방')).length,3);
});
test('catalog context includes registered material and care, omits stale prices',async()=>{
 const p={...products[0],specs:{material:'nylon',care:'label-specific care'}};
 const c=await loadProductContext('가방 관리',async()=>({catalog:{products:[p]},persisted:false}));
 assert.equal(c.facts[0].specs.care,'label-specific care');assert.equal(c.facts[0].price,undefined);
});
test('AI receives actual product facts and returns only catalog-backed cards',async()=>{
 const env={...process.env}, original=globalThis.fetch;let sent;
 process.env.SUPPORT_AI_ENABLED='true';process.env.SUPPORT_AI_MODEL='test';process.env.OPENAI_API_KEY='test';delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
 const id=chooseCandidates(products,'30대 남자 직장인')[0].id;
 globalThis.fetch=async(url,init)=>{sent=JSON.parse(init.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'출근용으로 No.1884를 추천합니다.',productIds:[id,'made-up']})}]}]});};
 try {
  const req=new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://himawari.co.kr','content-type':'application/json'},body:JSON.stringify({message:'30대 남자 직장인인데 가방추천해줘',productHistory:['test@example.com']})});
  const result=await (await assistant(req)).json();
  assert.equal(result.mode,'ai');assert.equal(result.products.length,1);assert.equal(result.products[0].id,id);
  assert.match(sent.instructions,/1884/);assert.doesNotMatch(sent.instructions,/test@example.com/);assert.equal(sent.store,false);
 }finally{globalThis.fetch=original;for(const key of ['SUPPORT_AI_ENABLED','SUPPORT_AI_MODEL','OPENAI_API_KEY','PRODUCT_BLOB_READ_WRITE_TOKEN']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});

test('care follow-ups retain the referenced product even if it is sold out',async()=>{
 const p={...products[0],id:'owned',soldOut:true,stock:0};
 const context=await loadProductContext('그 가방 관리',async()=>({catalog:{products:[...products,p]},persisted:true}),['owned']);
 assert.equal(context.candidates[0].id,'owned');
 assert.ok(!chooseCandidates([p],'가방 추천').length);
});

test('general bag questions use expertise without forcing shopping cards',async()=>{
 const env={...process.env}, original=globalThis.fetch;let count=0;
 process.env.SUPPORT_AI_ENABLED='true';process.env.SUPPORT_AI_MODEL='test';process.env.OPENAI_API_KEY='test';delete process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
 globalThis.fetch=async(url,init)=>{count++;const sent=JSON.parse(init.body);assert.match(sent.instructions,/일반 가방 지식은 직접 설명/);assert.match(sent.instructions,/불필요한 구매 권유/);return Response.json({output:[{type:'message',content:[{type:'output_text',text:sent.instructions.includes('JSON 객체')?JSON.stringify({answer:'먼저 양쪽 끈을 같은 길이로 조절해 보세요.',productIds:[]}):'먼저 양쪽 끈을 같은 길이로 조절해 보세요.'}]}]});};
 try {
  for(const message of ['지퍼가 뻑뻑해','나일론과 폴리에스터 차이','편하게 메는 법','맨날 한쪽만 내려와']){
   const req=new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://himawari.co.kr','content-type':'application/json'},body:JSON.stringify({message})});
   const result=await (await assistant(req)).json();assert.equal(result.mode,'ai');assert.deepEqual(result.products,[]);
  }assert.equal(count,4);
 }finally{globalThis.fetch=original;for(const key of ['SUPPORT_AI_ENABLED','SUPPORT_AI_MODEL','OPENAI_API_KEY','PRODUCT_BLOB_READ_WRITE_TOKEN']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
