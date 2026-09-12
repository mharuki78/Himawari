import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../assets/game.js', import.meta.url), 'utf8');
function setup() {
  const props = {};
  const node = { style: {setProperty(k,v) { props[k]=v; }}, classList: {add(){},remove(){},toggle(){}} };
  const state = {phase:'catch',lastFrame:0,paused:false,arriving:false,journeyElapsed:0,time:35,directions:new Set(),objects:[],projectiles:[],playerX:50,playerY:76};
  const c = {state,CATCH_SECONDS:35,ARRIVAL_SECONDS:2,routeMetrics:{height:600,mapHeight:2800},journeyStatus:{textContent:""},reducedMotion:false,document:{hidden:false},window:{requestAnimationFrame(){return 1;}},catchStage:node,player:node,root:{querySelector(){return {};}},stickX:0,stickY:0,renderPlayer(){},renderHud(){},completeCatch(){state.phase='pack';},finishCatch(){state.arriving=true;state.arrivalElapsed=0;state.arrivalStartY=state.playerY;}};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('  function routeOffset('),source.indexOf('  function runClock(')),c);
  return {c,state,props};
}
test('journey, clock and gate progress together and freeze while paused or hidden',()=>{
  const {c,state,props}=setup();
  for(let n=1;n<=800;n++) c.updateWorld(n*35);
  assert.ok(state.journeyElapsed>27);
  assert.equal(state.time,8);
  assert.ok(parseFloat(props['--route-offset']) > -2200);
  assert.equal(props['--journey-zoom'],undefined);
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

test('fixed-scale camera moves linearly in one direction without exposing map edges',()=>{
  const {c}=setup();
  for(const [height,mapHeight] of [[600,2800],[520,1170],[720,1170]]) {
    const start=c.routeOffset(height,mapHeight,0),end=c.routeOffset(height,mapHeight,1);
    assert.ok(start<=end); assert.ok(end<=0); assert.ok(start+mapHeight>=height);
    assert.equal(c.routeOffset(height,mapHeight,.5),(start+end)/2);
    for(let n=0;n<=100;n++) {
      const offset=c.routeOffset(height,mapHeight,n/100);
      assert.ok(offset<=0); assert.ok(offset+mapHeight>=height);
    }
  }
});
test('low frame rates do not slow down the journey clock',()=>{
  const {c,state}=setup();
  for(let n=1;n<=351;n++) c.updateWorld(n*100);
  assert.equal(state.time,0);assert.equal(state.arriving,true);
});
