import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateEntries, root } from '../scripts/build-lookbook.mjs';
import { validateStoryCount } from '../scripts/lib/publication-schedule.mjs';
const source=JSON.parse(fs.readFileSync(`${root}/lookbook/entries.json`,'utf8'))[0];
function photos(date,count){return Array.from({length:count},(_,i)=>({...source,date,id:`${date}-everyday-model${i}`,model:`model${i}`,image:`/assets/lookbook/${date}-model${i}.webp`,thumbnail:`/assets/lookbook/${date}-model${i}-640.webp`}));}
test('two LookBook editions fit on October 3–7 and stay valid in later galleries',()=>{
 for(const date of ['2026-10-03','2026-10-07'])assert.doesNotThrow(()=>validateEntries(photos(date,4),{today:'2026-10-08',checkFiles:false}));
});
test('extra LookBook editions are rejected outside the approved dates',()=>{
 for(const date of ['2026-10-02','2026-10-08'])assert.throws(()=>validateEntries(photos(date,4),{today:'2026-10-08',checkFiles:false}));
 assert.throws(()=>validateEntries(photos('2026-10-03',5),{today:'2026-10-08',checkFiles:false}));
});
test('second story edition requires all six posts and is limited to approved dates',()=>{
 for(const date of ['2026-10-03','2026-10-07']) {
  assert.doesNotThrow(()=>validateStoryCount(date,3));
  assert.doesNotThrow(()=>validateStoryCount(date,6,6));
  for(const count of [3,4,5,7])assert.throws(()=>validateStoryCount(date,count,6));
  assert.throws(()=>validateStoryCount(date,6));
 }
 for(const date of ['2026-10-02','2026-10-08']) {
  assert.doesNotThrow(()=>validateStoryCount(date,3));
  assert.throws(()=>validateStoryCount(date,6,6));
 }
});
