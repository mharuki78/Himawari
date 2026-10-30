import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeColourChoices, getHomeHeroSelection } from '../assets/home-colours.js';
const mint={id:'store-11070824181',name:'Himawari No.0422 민트',model:'No.0422',image:'https://example.com/mint.jpg'};
test('colour choices use catalogue identity, photo and encoded internal detail route',()=>{
 const [choice]=getHomeColourChoices([mint]);
 assert.equal(choice.label,'민트');assert.equal(choice.image,mint.image);assert.equal(choice.name,mint.name);
 assert.equal(choice.href,'/product.html?id=store-11070824181');
});
test('missing catalogue entries produce no invented choices',()=>{assert.deepEqual(getHomeColourChoices([]),[]);assert.deepEqual(getHomeColourChoices(null),[]);});
test('unsafe, missing or wrong-model catalogue photos are excluded',()=>{
 for(const change of [{image:'javascript:alert(1)'},{image:'http://example.com/mint.jpg'},{image:''},{model:'No.9007',name:'No.9007 민트'}])assert.deepEqual(getHomeColourChoices([{...mint,...change}]),[]);
});
test('catalogue duplicates cannot create duplicate picker choices',()=>{assert.equal(getHomeColourChoices([mint,mint]).length,1);});
const other={id:'other-9007',name:'Himawari No.9007 블랙',model:'No.9007',image:'https://example.com/9007.jpg'};
test('random hero can select another real model and its own current colour choices',()=>{
 const result=getHomeHeroSelection([mint,other],{previousModel:'0422',random:()=>0});
 assert.equal(result.model,'9007');assert.equal(result.initial.id,other.id);assert.equal(result.initial.model,'No.9007');
 assert.deepEqual(result.choices.map(c=>c.label),['블랙']);
});
test('single eligible model remains usable and an empty catalogue is explicit',()=>{
 assert.equal(getHomeHeroSelection([mint],{previousModel:'0422',random:()=>0}).model,'0422');
 assert.equal(getHomeHeroSelection([]),null);
});
test('colour labels use current catalogue facts rather than fixed product-id assumptions',()=>{
 assert.equal(getHomeColourChoices([{...mint,name:'No.0422 블랙'}])[0].label,'블랙');
 assert.equal(getHomeColourChoices([other],'9007')[0].href,'/product.html?id=other-9007');
});
test('hero excludes unsafe photos and deduplicates same-colour variants without changing input',()=>{
 const products=[{...mint,id:'bundle',name:'No.0422 민트+체스트벨트 SET'},mint,{...other,image:'javascript:bad'}];
 assert.equal(getHomeHeroSelection(products,{random:()=>0}).initial.id,mint.id);
 assert.equal(products[0].id,'bundle');
});
test('selected checks contrast with the actual colour rather than its picker position',()=>{
 assert.equal(getHomeColourChoices([other],'9007')[0].checkColour,'#ffffff');
 assert.equal(getHomeColourChoices([mint])[0].checkColour,'#202423');
});
