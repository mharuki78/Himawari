import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderProductPage } from '../api/_lib/storefront.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const template=read('templates/product.html');
const parse=html=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const d=JSON.parse(m[1]);return d['@graph']||[d];});
const black={id:'bag-black',model:'No.2513',name:'히마와리 No.2513 블랙',price:64900,soldOut:false,image:'https://example.com/bag.jpg',gallery:[],highlights:[]};
const mint={...black,id:'bag-mint',name:'히마와리 No.2513 민트',price:120000};

test('all selected and sibling offers use the owner-confirmed transit range separately from dispatch',()=>{
 const offers=parse(renderProductPage(template,black,undefined,null,[black,mint])).filter(d=>d['@type']==='Product').map(d=>d.offers);
 assert.equal(offers.length,2);
 for(const offer of offers){
  const s=offer.shippingDetails;
  assert.deepEqual(s.shippingDestination,{'@type':'DefinedRegion',addressCountry:'KR'});
  assert.deepEqual(s.deliveryTime.handlingTime,{'@type':'QuantitativeValue',minValue:0,maxValue:2,unitCode:'DAY'});
  assert.deepEqual(s.deliveryTime.transitTime,{'@type':'QuantitativeValue',minValue:1,maxValue:2,unitCode:'DAY'});
  assert.deepEqual(s.deliveryTime.businessDays,{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d=>'https://schema.org/'+d)});
  assert.equal(s.deliveryTime.cutoffTime,undefined,'Do not invent an order cutoff');
 }
 assert.equal(offers.find(o=>o.price==='64900').shippingDetails.shippingRate.value,'3500');
 assert.equal(offers.find(o=>o.price==='120000').shippingDetails.shippingRate.value,'0');
});

test('public product, checkout and terms distinguish dispatch from regional transit with weekend/holiday exclusions',()=>{
 for(const file of ['templates/product.html','checkout.html','terms.html']){
  const html=read(file);
  assert.match(html,/일반 지역[^<.]*1영업일/,file);
  assert.match(html,/제주·도서산간[^<.]*2영업일 이내/,file);
  assert.ok(html.includes('토·일·공휴일'),file);
  assert.match(html,/영업일 기준 2일 이내 출고/,file);
 }
});
