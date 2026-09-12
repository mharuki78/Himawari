import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../assets/game.js', import.meta.url), 'utf8');
function setup() {
  const props = {};
  const node = { style: {setProperty(k,v) { props[k]=v; }}, classList: {add(){},remove(){},toggle(){}} };
  const state = {phase:'catch',lastFrame:0,paused:false,arriving:false,journeyElapsed:0,time:35,directions:new Set(),objects:[],projectiles:[],playerX:50,playerY:76};
  const c = {state,CATCH_SECONDS:35,reducedMotion:false,document:{hidden:false},window:{requestAnimationFrame(){return 1;}},catchStage:node,player:node,root:{querySelector(){return {};}},stickX:0,stickY:0,renderPlayer(){},renderHud(){},completeCatch(){state.phase='pack';},finishCatch(){state.arriving=true;state.arrivalElapsed=0;state.arrivalStartY=state.playerY;}};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('  function renderJourney()'),source.indexOf('  function runClock(')),c);
  return {c,state,props};
}
test('journey, clock and gate progress together and freeze while paused or hidden',()=>{
  const {c,state,props}=setup();
  for(let n=1;n<=800;n++) c.updateWorld(n*35);
  assert.ok(state.journeyElapsed>27);
  assert.equal(state.time,8);
  assert.equal(props['--gate-opacity'],'1');
  const elapsed=state.journeyElapsed;
  state.paused=true; c.updateWorld(28035);
  assert.equal(state.journeyElapsed,elapsed);
  state.paused=false;c.document.hidden=true;c.updateWorld(28070);
  assert.equal(state.journeyElapsed,elapsed);
});
test('full journey enters gate crossing before packing and crossing also pauses',()=>{
  const {c,state}=setup();
  for(let n=1;n<=1002;n++) c.updateWorld(n*35);
  assert.equal(state.time,0);
  assert.equal(state.arriving,true);
  assert.equal(state.phase,'catch');
  state.paused=true;c.updateWorld(35105);assert.equal(state.arrivalElapsed,0);
  state.paused=false;
  for(let n=1004;n<=1065;n++) c.updateWorld(n*35);
  assert.equal(state.phase,'pack');assert.equal(state.playerY,28);
});
