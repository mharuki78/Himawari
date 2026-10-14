import test from 'node:test';
import assert from 'node:assert/strict';
import * as quality from '../scripts/lib/publication-schedule.mjs';
const image=(name,kind='generated')=>({image:`assets/story/${name}.webp`,imageKind:kind,reference:'backups/story-2026-10-15/product.jpg',generatedSource:`backups/story-2026-10-15/${name}.png`,prompt:'Specific real product, distinct scene',fidelityReviewed:true,role:kind==='reference'?'reference':name,sourceUrl:'https://himawari.co.kr/api/products'});
const record={id:'a',editorialForm:'comparison',coreQuestion:'What changes the decision?',image:'assets/story/scene.webp',images:[image('scene'),image('detail'),image('reference','reference')]};
const html=()=>`<div class="story-body"><p>${'가나다라마바사아자차카타파하'.repeat(190)}</p></div>`+record.images.map(x=>`<img src="../${x.image}" alt="${x.imageKind==='generated'?'AI 연출':'실제 제품'} 사진">`).join('');

test('new story publication accepts three real image records and a developed body',()=>{
 assert.doesNotThrow(()=>quality.validateStoryEditorial('2026-10-15',record,html()));
});
test('new story publication rejects short body, reused images and missing generated evidence',()=>{
 assert.throws(()=>quality.validateStoryEditorial('2026-10-15',record,html().replace(/가나다[^<]+/, '짧은 글')),/본문/);
 assert.throws(()=>quality.validateStoryEditorial('2026-10-15',{...record,images:[record.images[0],record.images[0],record.images[2]]},html()),/중복/);
 assert.throws(()=>quality.validateStoryEditorial('2026-10-15',{...record,images:record.images.map(x=>({...x,prompt:''}))},html()),/생성 근거/);
 assert.throws(()=>quality.validateStoryEditorial('2026-10-15',{...record,images:record.images.map(x=>({...x,role:'same-scene'}))},html()),/서로 다른 역할/);
});
test('old publication records keep their original single-image contract',()=>{
 assert.doesNotThrow(()=>quality.validateStoryEditorial('2026-10-14',{id:'a',image:'assets/story/a.webp'},'<p>기존 글</p>'));
});
test('new LookBook rejects a pair of rear full-body approaches even with different places',()=>{
 const rows=[1,2].map(i=>({composition:{approach:`place${i}`,angle:'rear',framing:'full-body',activity:'standing',setting:`place${i}`}}));
 assert.throws(()=>quality.validateLookbookEditorial('2026-10-15',rows),/뒷모습 전신/);
});
test('new LookBook accepts different photography approaches and rejects absent planning',()=>{
 const rows=[{composition:{approach:'activity',angle:'side',framing:'waist-up',activity:'reading',setting:'library'}},{composition:{approach:'street',angle:'rear',framing:'full-body',activity:'walking',setting:'street'}}];
 assert.doesNotThrow(()=>quality.validateLookbookEditorial('2026-10-15',rows));
 assert.throws(()=>quality.validateLookbookEditorial('2026-10-15',[{},{}]),/촬영/);
 assert.doesNotThrow(()=>quality.validateLookbookEditorial('2026-10-14',[{},{}]));
});
