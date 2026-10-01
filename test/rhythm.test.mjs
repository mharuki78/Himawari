import test from 'node:test';
import assert from 'node:assert/strict';
import { Round, chart, scoreRound, eligibleTiers, DURATION, WINDOW } from '../assets/rhythm-core.mjs';
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
