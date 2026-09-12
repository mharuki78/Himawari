import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../assets/game.js',import.meta.url),'utf8');
function setup(reduced=false){
  const timers=[]; const attrs={}; const classes=new Set();
  const item={id:'laptop',label:'노트북',zone:'laptop'};
  const c={state:{phase:'pack',packed:new Set(),packItems:[item,{id:'book'}],packBusy:false,packFinishing:false,score:0},zones:[{id:'laptop',label:'노트북 수납'}],packingBag:{dataset:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},removeAttribute(){},querySelector:()=>({setAttribute:(k,v)=>attrs[k]=v})},packStatus:{textContent:''},packingItems:{querySelector:()=>null},document:{activeElement:null},window:{setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearInterval(){}},PACK_TRANSFER_MS:2200,reducedMotion:reduced,announce(){},renderPackingBoard(){},setScore(n){c.state.score+=n;},playEffect(){},finishGame(){c.state.phase='result';}};
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
 c.runClock(22,()=>{});tick();assert.equal(c.state.time,22);c.state.packBusy=false;tick();assert.equal(c.state.time,21);
});
