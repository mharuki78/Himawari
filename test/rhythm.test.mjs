import test from 'node:test';
import assert from 'node:assert/strict';
import { Round, VERSION, chart, judgement, scoreRound, eligibleTiers, BEAT, DURATION, WINDOW } from '../assets/rhythm-core.mjs';
import { createHmac } from 'node:crypto';
import { startRhythmSession, verifyRhythmSession } from '../api/_lib/rhythm-session.js';
import { RHYTHM_CLAIM_SQL } from '../api/_lib/coupon-claims.js';
import { PGlite } from '@electric-sql/pglite';
import { fetch as ordersFetch } from '../api/orders.js';

const perfect = (seed = 1) => chart(seed).flatMap(n => [{ type: 'down', at: n.at }, { type: 'up', at: n.at + (n.duration || 20) }]);
test('complete chart fits music; full perfect score and misses have honest reward thresholds', () => {
  for (const seed of [0, 1, 4294967295]) {
    const notes = chart(seed); assert.ok(notes.at(-1).at + notes.at(-1).duration + WINDOW < DURATION);
    const result = scoreRound(seed, perfect(seed)); assert.equal(result.score, 10000); assert.equal(result.miss, 0);
    assert.equal(scoreRound(seed, []).score, 0);
  }
  assert.deepEqual(eligibleTiers(4999), []); assert.deepEqual(eligibleTiers(6500), ['discount-10', 'shipping-free']);
});
test('tap cannot score repeatedly; early release loses the zipper tail; timing offset is shared', () => {
  const round = new Round(1), note = round.notes[0]; round.press(note.at); const score = round.score;
  assert.equal(round.press(note.at), false); assert.equal(round.score, score); round.release(note.at + 20);
  const hold = round.notes.find(n => n.duration); round.press(hold.at); round.release(hold.at + 100);
  assert.equal(hold.head, 'perfect'); assert.equal(hold.tail, 'miss');
  const shifted = perfect().map(e => ({ ...e, at: e.at + 100 }));
  assert.equal(scoreRound(1, shifted, -100).score, 10000); assert.ok(scoreRound(1, shifted).score < 10000);
});

test('denser chapters remain playable with non-overlapping timing windows and varied holds', () => {
  for(const seed of [0,1,1884,4294967295]) {
    const notes=chart(seed),byScene=[0,1,2].map(scene=>notes.filter(n=>n.scene===scene));
    assert.ok(byScene[1].length>byScene[0].length);assert.ok(byScene[2].length>byScene[1].length);
    assert.ok(notes.length>120);
    for(let i=1;i<notes.length;i++) {
      const previous=notes[i-1],gap=notes[i].at-previous.at-previous.duration;
      assert.ok(gap>WINDOW*2,`unsafe gap ${gap}`);
    }
    assert.ok(notes.some(n=>Math.abs(n.at/BEAT-Math.round(n.at/BEAT))>.1));
    assert.equal(new Set(notes.filter(n=>n.duration).map(n=>n.duration)).size,3);
  }
  assert.equal(judgement(45),'perfect');assert.equal(judgement(-45),'perfect');
  assert.equal(judgement(46),'good');assert.equal(judgement(-100),'good');
  assert.equal(judgement(101),'miss');assert.equal(judgement(-101),'miss');
});

test('quarter-note-only play cannot reach the 10% tier on the challenge chart', () => {
  const taps=[];
  for(let beat=4;beat<100;beat++)taps.push({type:'down',at:beat*BEAT},{type:'up',at:beat*BEAT+20});
  for(const seed of [0,1,1884])assert.ok(scoreRound(seed,taps).score<6500);
});

test('empty taps cost points and break combo without inventing missed notes', () => {
  const round=new Round(0),first=round.notes[0];
  round.press(first.at);round.release(first.at+20);
  const before=round.score,counts={...round.counts};
  round.press(first.at+160);round.release(first.at+180);
  assert.equal(round.combo,0);assert.equal(round.empty,1);assert.ok(round.score<before);
  assert.deepEqual(round.counts,counts);assert.equal(round.result().empty,1);
  round.press(first.at+200);round.release(first.at+220);
  assert.ok(round.points>=0);
  const countdown=new Round(0);countdown.press(100);countdown.release(120);assert.equal(countdown.empty,0);
});

test('signed sessions from the old chart are rejected instead of rescored against new notes', () => {
  process.env.MEMBER_SESSION_SECRET='rhythm-test-secret-only';
  const start=1790809200000,session=startRhythmSession('browser-a',start);
  assert.equal(session.version,VERSION);
  const payload=JSON.parse(Buffer.from(session.session.split('.')[0],'base64url').toString());payload.v=1;
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signed=encoded+'.'+createHmac('sha256',process.env.MEMBER_SESSION_SECRET).update(encoded).digest('base64url');
  assert.throws(()=>verifyRhythmSession('browser-a',{session:signed,events:perfect(payload.seed)},start+DURATION),e=>e.status===422);
});
test('out of order, duplicate presses, impossible times and excessive events are rejected', () => {
  for (const events of [[{type:'down',at:100},{type:'up',at:90}], [{type:'down',at:0},{type:'down',at:1}], [{type:'up',at:20}], [{type:'down',at:DURATION+1}], Array(769).fill({type:'down',at:0})]) assert.throws(() => scoreRound(1, events));
  assert.throws(() => scoreRound(1, [], 151));
});
test('server session rejects tampering, another browser, instant claims and expiry; ignores submitted score', () => {
  process.env.MEMBER_SESSION_SECRET = 'rhythm-test-secret-only';
  const start = 1790809200000, session = startRhythmSession('browser-a', start);
  const input = {session:session.session, events:perfect(session.seed), offset:0, score:0};
  const result = verifyRhythmSession('browser-a', input, start + DURATION + 100);
  assert.equal(result.result.score, 10000); assert.equal(result.campaign, 'rhythm-2026-10-01');
  for (const [owner, data, now] of [['browser-b',input,start+DURATION], ['browser-a',{...input,session:input.session+'x'},start+DURATION], ['browser-a',input,start+1000], ['browser-a',input,start+16*60_000]]) assert.throws(() => verifyRhythmSession(owner,data,now), e=>e.status===422);
});
test('daily coupon retries preserve a higher tier and never reopen a used coupon', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE coupon_claims (id text PRIMARY KEY,owner_hash text,campaign text,coupon_id text,token_hash text,expires_at timestamptz,used_at timestamptz,UNIQUE(owner_hash,campaign))`);
    const claim = id => db.query(RHYTHM_CLAIM_SQL, ['claim','owner','rhythm-2026-10-01',id,`token-${id}`,new Date(Date.now()+86400000).toISOString()]);
    assert.equal((await claim('discount-10')).rows[0].coupon_id, 'discount-10');
    assert.equal((await claim('discount-20')).rows[0].coupon_id, 'discount-20');
    assert.equal((await claim('discount-10')).rows.length, 0);
    assert.equal((await db.query('SELECT token_hash FROM coupon_claims')).rows[0].token_hash, 'token-discount-20');
    await db.query('UPDATE coupon_claims SET used_at=now()');
    assert.equal((await claim('discount-20')).rows.length, 0);
  } finally { await db.close(); }
});

test('rhythm endpoints require same-origin POST and bind a secure browser cookie', async () => {
  process.env.MEMBER_SESSION_SECRET = 'rhythm-test-secret-only';
  const url = 'https://himawari.co.kr/api/orders?route=rhythm-start';
  assert.equal((await ordersFetch(new Request(url))).status, 405);
  assert.equal((await ordersFetch(new Request(url, {method:'POST',headers:{Origin:'https://other.example'}}))).status, 403);
  const response = await ordersFetch(new Request(url, {method:'POST',headers:{Origin:'https://himawari.co.kr'}}));
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie'), /^__Host-himawari_coupon=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000; Secure$/);
  const session = await response.json();
  const headers = {Origin:'https://himawari.co.kr',Cookie:response.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'};
  const finishUrl = 'https://himawari.co.kr/api/orders?route=rhythm-finish';
  assert.equal((await ordersFetch(new Request(finishUrl,{method:'POST',headers,body:JSON.stringify({session:session.session,events:[],score:10000})}))).status,422);
  assert.equal((await ordersFetch(new Request(finishUrl,{method:'POST',headers,body:'x'.repeat(65537)}))).status,413);
});
