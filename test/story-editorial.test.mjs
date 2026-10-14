import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=async()=>import('../scripts/lib/story-editorial.mjs').catch(()=>({renderRevision:()=>{throw Error('Editorial renderer missing');}}));
const post=JSON.parse(fs.readFileSync(new URL('../story/posts.json',import.meta.url)))[0];
const original={...post,html:fs.readFileSync(new URL(`../story/${post.url}`,import.meta.url),'utf8'),product:{id:'test-product',model:'No.1088M'}};
const revision={id:original.id,title:'국제 통화, 시간 & 날짜',summary:'한 도시의 날짜와 시간을 확인해 통화 약속을 잡는 방법입니다.',bodyHtml:'<p>첫 문단입니다.</p><!-- editorial-reference --><h2>날짜가 다른 약속</h2><p>두 번째 문단입니다.</p>',faqs:[],editorialForm:'해설'};
const photo={asset:'assets/story/reference.webp',width:1000,height:1000,sourceUrl:'https://catalog.example/photo.jpg'};
test('generated supporting photograph is disclosed and never described as a catalogue photograph',async()=>{
 const {renderRevision}=await load();
 const result=renderRevision(original,revision,{...photo,kind:'generated'},'2026-10-14');
 const figure=result.match(/<figure class="story-inline-figure">[\s\S]*?<\/figure>/)[0];
 assert.match(figure,/AI 연출/);assert.ok(!figure.includes('공식 카탈로그에 실린 사진'));
});
test('revision keeps identity, publication date and hero while updating article and social metadata',async()=>{
 const {renderRevision}=await load();
 const result=renderRevision(original,revision,photo,'2026-10-14');
 assert.match(result,/<h1>국제 통화, 시간 &amp; 날짜<\/h1>/);
 assert.ok(result.includes(`datetime="${original.date}"`));
 assert.ok(result.includes(original.image));
 assert.ok(result.includes(`https://himawari.co.kr/story/${original.url}`));
 const schema=[...result.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
 const blog=schema.find(x=>x['@type']==='BlogPosting');
 assert.equal(blog.datePublished,original.date);assert.equal(blog.dateModified,'2026-10-14');assert.equal(blog.headline,revision.title);
 assert.equal(blog.image.length,2);
 assert.ok(!schema.some(x=>x['@type']==='FAQPage'));
 assert.ok(!result.includes('class="story-faq"'));
 assert.match(result,/class="story-inline-figure"/);assert.match(result,/loading="lazy"/);
});
test('revision renders only its actual FAQ and rejects a mismatched article id',async()=>{
 const {renderRevision}=await load();
 const result=renderRevision(original,{...revision,faqs:[{question:'시간은 어느 도시 기준인가요?',answer:'약속한 도시의 시간입니다.'}]},photo,'2026-10-14');
 assert.match(result,/<summary>시간은 어느 도시 기준인가요\?<\/summary>/);
 assert.throws(()=>renderRevision(original,{...revision,id:'different'},photo,'2026-10-14'),/ID/);
});

test('rewriting a body retains its existing related-story navigation',async()=>{
 const {renderRevision}=await load();
 const withRelated={...original,html:original.html.replace(/<p class="story-related">[\s\S]*?<\/p>/g,'').replace(/(<div class="story-body">[\s\S]*?)(<\/div>)/,'$1<p class="story-related">함께 읽기: <a href="jigsaw-board-finished-size.html">작업 공간 살펴보기</a></p>$2')};
 const result=renderRevision(withRelated,revision,photo,'2026-10-14');
 assert.match(result,/<p class="story-related">함께 읽기: <a href="jigsaw-board-finished-size.html">작업 공간 살펴보기<\/a><\/p>/);
});
