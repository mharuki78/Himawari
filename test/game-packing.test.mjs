import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import { PACK_SECONDS, WRONG_POCKET_SECONDS } from '../assets/game-difficulty.mjs';
const src=readFileSync(new URL('../assets/game.js',import.meta.url),'utf8');
function setup(reduced=false){
  const timers=[]; const attrs={}; const classes=new Set();
  const item={id:'laptop',label:'노트북',zone:'laptop'};
  const c={state:{phase:'pack',time:PACK_SECONDS,packed:new Set(),packItems:[item,{id:'book'}],packBusy:false,packFinishing:false,score:0},zones:[{id:'laptop',label:'노트북 수납'}],packingBag:{dataset:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},removeAttribute(){},querySelector:()=>({setAttribute:(k,v)=>attrs[k]=v})},packStatus:{textContent:''},packingItems:{querySelector:()=>null},document:{activeElement:null},window:{setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearInterval(){}},PACK_TRANSFER_MS:2200,WRONG_POCKET_SECONDS,reducedMotion:reduced,announce(){},showToast(){},renderHud(){},renderPackingBoard(){},setScore(n){c.state.score+=n;},playEffect(){},finishGame(){c.state.phase='result';}};
  vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function packItem('),src.indexOf('  function readStoredReward(')),c);
  return {c,item,timers,classes,attrs};
}
test('one tap opens correct pocket and only awards once after insertion completes',()=>{
 const {c,item,timers,attrs}=setup();c.packItem(item);c.packItem(item);
 assert.equal(timers.length,1);assert.equal(c.state.score,0);assert.equal(c.state.packBusy,true);assert.equal(c.packingBag.dataset.pocket,'laptop');assert.equal(attrs.href,'#pack-stowed-laptop');
 timers[0].fn();assert.equal(c.state.score,150);assert.equal(c.state.packBusy,false);assert.equal(c.state.packed.has('laptop'),true);
 c.packItem(item);assert.equal(timers.length,1);
});
test('last item finishes only after closing and completion feedback',()=>{
 const {c,item,timers}=setup();c.state.packItems=[item];c.packItem(item);timers[0].fn();assert.equal(c.state.phase,'pack');assert.equal(c.state.packFinishing,true);assert.equal(timers[1].ms,700);timers[1].fn();assert.equal(c.state.phase,'result');
});
test('leaving packing prevents pending callback from awarding points',()=>{
 const {c,item,timers}=setup();c.packItem(item);c.state.phase='intro';timers[0].fn();assert.equal(c.state.score,0);
});
test('reduced motion completes without a long animation wait',()=>{
 const {c,item,timers}=setup(true);c.packItem(item);assert.equal(timers[0].ms,250);timers[0].fn();assert.equal(c.state.score,150);
});

test('packing clock does not consume time during insertion',()=>{
 let tick;
 const c={state:{phase:'pack',packBusy:true},document:{hidden:false},renderHud(){},window:{clearInterval(){},setInterval(fn){tick=fn;return 1;}}};
 vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function runClock('),src.indexOf('  function startCatch(')),c);
 c.runClock(PACK_SECONDS,()=>{});tick();assert.equal(c.state.time,PACK_SECONDS);c.state.packBusy=false;tick();assert.equal(c.state.time,PACK_SECONDS-1);
});

function arrivalSetup(caught,lives=3){
 const c={state:{caught,lives,phase:'catch'},goodItems:[{id:'book'},{id:'laptop'},{id:'bottle'},{id:'pencil'}],clearRound(){},packingItems:{replaceChildren(){},querySelector(){return null;}},packingBag:{classList:{remove(){}}},packStatus:{},renderPackingBoard(){},showPanel(phase){c.state.phase=phase;},announce(){},runClock(seconds){c.seconds=seconds;},finishGame(){c.state.phase='result';},PACK_SECONDS};
 vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function completeCatch('),src.indexOf('  function renderPackingBoard(')),c);return c;
}

test('packing only includes collected types; duplicates do not generate free bonus items',()=>{
 const c=arrivalSetup([{id:'book'},{id:'book'}]);c.completeCatch();
 assert.equal(c.state.phase,'pack');assert.deepEqual(Array.from(c.state.packItems,item=>item.id),['book']);assert.equal(c.seconds,12);
});

test('empty collection and loss of all lives end without a packing bonus stage',()=>{
 for(const [items,lives] of [[[],3],[[{id:'book'}],0]]){
  const c=arrivalSetup(items,lives);c.completeCatch();assert.equal(c.state.phase,'result');assert.equal(c.seconds,undefined);assert.equal(c.state.packed.size,0);
 }
});

function matchingSetup(){
 const {c,item,timers}=setup();
 vm.runInContext(src.slice(src.indexOf('  function selectPackingItem('),src.indexOf('  function packItem(')),c);
 return {c,item,timers};
}
test('selection and wrong pocket never award points; correct pocket starts insertion once',()=>{
 const {c,item,timers}=matchingSetup(); c.matchPackingZone('front');assert.equal(timers.length,0);
 c.selectPackingItem(item);assert.equal(timers.length,0);assert.equal(c.state.selectedItem,'laptop');
 c.matchPackingZone('front');assert.equal(timers.length,0);assert.equal(c.state.score,0);
 c.matchPackingZone('laptop');c.matchPackingZone('laptop');assert.equal(timers.length,1);
 timers[0].fn();assert.equal(c.state.score,150);
});
test('all four item types require their matching compartment',()=>{
 for(const [id,zone] of [['book','main'],['laptop','laptop'],['bottle','side'],['pencil','front']]){
  const {c,timers}=matchingSetup();const item={id,zone,label:id};c.state.packItems=[item,{id:'spare'}];c.zones=[{id:zone,label:zone}];
  c.selectPackingItem(item);c.matchPackingZone('wrong');assert.equal(timers.length,0);
  c.matchPackingZone(zone);assert.equal(timers.length,1);timers[0].fn();assert.equal(c.state.packed.has(id),true);
 }
});

test('only a wrong pair costs time; selecting a compartment alone is free',()=>{
 const {c,item,timers}=matchingSetup();
 c.matchPackingZone('front');assert.equal(c.state.time,12);
 c.selectPackingItem(item);assert.equal(c.state.time,10);assert.equal(c.state.selectedZone,'');assert.equal(timers.length,0);
 c.matchPackingZone('laptop');assert.equal(c.state.time,10);assert.equal(timers.length,1);
 c.matchPackingZone('front');assert.equal(c.state.time,10); // Insertion owns the controls.
});

test('wrong pocket at the time limit ends the round without negative time or points',()=>{
 const {c,item,timers}=matchingSetup();c.state.time=1;
 c.selectPackingItem(item);c.matchPackingZone('front');
 assert.equal(c.state.time,0);assert.equal(c.state.phase,'result');assert.equal(c.state.score,0);assert.equal(timers.length,0);
 c.matchPackingZone('front');assert.equal(c.state.time,0);
});


test('compartment first supports every pair, clears selection, and keeps the bottle stored',()=>{
 for(const [id,zone] of [['book','main'],['laptop','laptop'],['bottle','side'],['pencil','front']]){
  const {c,timers,classes}=setup();
  vm.runInContext(src.slice(src.indexOf('  function selectPackingItem('),src.indexOf('  function packItem(')),c);
  const item={id,zone,label:id};c.state.packItems=[item,{id:'spare'}];c.zones=[{id:zone,label:zone}];
  c.matchPackingZone(zone);assert.equal(c.state.selectedZone,zone);assert.equal(timers.length,0);
  c.selectPackingItem(item);assert.equal(timers.length,1);timers[0].fn();
  assert.equal(c.state.selectedZone,'');assert.equal(c.state.selectedItem,'');assert.equal(c.state.score,150);
  if(id==='bottle') assert.equal(classes.has('has-bottle'),true);
  c.matchPackingZone(zone);c.selectPackingItem(item);assert.equal(timers.length,1);
 }
});

test('completed pairs are removed from both sets of selectable buttons',()=>{
 const {c,item}=setup();c.state.packed.add(item.id);
 function button(dataset){return {dataset,classList:{toggle(){}},setAttribute(){},querySelector:()=>({textContent:''})};}
 const done=button({packItem:'laptop'}), remaining=button({packItem:'book'});
 const zone=button({packZone:'laptop'}), open=button({packZone:'main'});
 c.packingItems.children=[done,remaining];c.packCount={};c.packingBag.setAttribute=()=>{};
 c.packingBag.querySelectorAll=()=>[zone,open];
 vm.runInContext(src.slice(src.indexOf('  function renderPackingBoard('),src.indexOf('  function selectPackingItem(')),c);
 c.renderPackingBoard();assert.equal(done.hidden,true);assert.equal(zone.hidden,true);
 assert.equal(remaining.hidden,false);assert.equal(open.hidden,false);assert.equal(c.packCount.textContent,'1 / 2');
});
