import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { campusDifficulty, campusResultTitle } from '../assets/game-difficulty.mjs';

test('campus pressure increases along the route and clamps to a playable maximum', () => {
  const first=campusDifficulty(0), middle=campusDifficulty(17.5), last=campusDifficulty(35);
  assert.ok(first.fallSpeed < middle.fallSpeed && middle.fallSpeed < last.fallSpeed);
  assert.ok(first.goodChance > last.goodChance && first.spawnInterval > last.spawnInterval);
  assert.deepEqual(campusDifficulty(-100),first);assert.deepEqual(campusDifficulty(Infinity),first);
  assert.deepEqual(campusDifficulty(100),last);
  assert.equal(last.maxObjects,9);assert.ok(last.goodChance >= .5);
  assert.equal(campusDifficulty(35,true).fallSpeed,0);assert.equal(campusDifficulty(35,true).spawnInterval,1100);
});

test('spawning respects pause, hidden pages, object cap and five-hazard limit', () => {
  const src=readFileSync(new URL('../assets/game.js',import.meta.url),'utf8');
  const good={id:'book'},hazard={id:'weight',hazard:true},created=[];
  const c={campusDifficulty,reducedMotion:false,Math:{random:()=>.99,floor:Math.floor},state:{phase:'catch',journeyElapsed:35,objects:[],paused:false,arriving:false},document:{hidden:false},goodItems:[good],hazards:[hazard],createCollectible:item=>created.push(item)};
  vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function spawnItem('),src.indexOf('  function scheduleSpawn(')),c);
  c.spawnItem();assert.equal(created.pop(),hazard);
  c.state.objects=Array(5).fill({item:hazard});c.spawnItem();assert.equal(created.pop(),good);
  for (const flag of ['paused','arriving']) { c.state[flag]=true;c.spawnItem();assert.equal(created.length,0);c.state[flag]=false; }
  c.document.hidden=true;c.spawnItem();assert.equal(created.length,0);c.document.hidden=false;
  c.state.objects=Array(9).fill({item:good});c.spawnItem();assert.equal(created.length,0);
});

test('campus result distinguishes death, empty collection, timeout and completed packing', () => {
  const state={lives:3,packItems:[],packed:new Set()};
  assert.match(campusResultTitle(state),/모으지 못/);
  state.packItems=[{id:'book'}];assert.match(campusResultTitle(state),/다음엔/);
  state.packed.add('book');assert.match(campusResultTitle(state),/완성/);
  state.lives=0;assert.match(campusResultTitle(state),/모험이 끝/);
});
