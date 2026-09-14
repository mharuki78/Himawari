import test from 'node:test';
import assert from 'node:assert/strict';
import { assistant, supportAnswer } from '../api/_lib/assistant.js';
import { startOAuth } from '../api/_lib/oauth.js';
import { providerIsConfigured } from '../api/_lib/member-auth.js';
const request=(message)=>new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://himawari.co.kr','content-type':'application/json'},body:JSON.stringify({message})});
test('guide shipping terms and unknown questions stay grounded',()=>{assert.match(supportAnswer('배송비').answer,/3,500/);assert.match(supportAnswer('내 택배 어디야').answer,/조회할 수 없습니다/);assert.equal(supportAnswer('대통령').link,'/contact.html');});
test('guide works without AI credentials and rejects personal details',async()=>{delete process.env.SUPPORT_AI_ENABLED;let r=await assistant(request('배송비'));assert.equal(r.status,200);assert.equal((await r.json()).mode,'guide');r=await assistant(request('010-1234-5678'));assert.match((await r.json()).answer,/개인정보/);});
test('assistant rejects cross-origin and oversized input',async()=>{const r=await assistant(new Request('https://himawari.co.kr/api/assistant',{method:'POST',headers:{origin:'https://evil.example'}}));assert.equal(r.status,403);assert.equal((await assistant(request('x'.repeat(801)))).status,400);});
test('Kakao requires explicit activation and generates a state protected redirect',()=>{
 process.env.KAKAO_CLIENT_ID='test';process.env.KAKAO_CLIENT_SECRET='test';delete process.env.KAKAO_LOGIN_ENABLED;
 assert.equal(providerIsConfigured('kakao'),false);process.env.KAKAO_LOGIN_ENABLED='true';process.env.MEMBER_SESSION_SECRET='x'.repeat(64);
 const r=startOAuth(new Request('https://himawari.co.kr/api/auth/start?provider=kakao&returnTo=/account.html'));const u=new URL(r.headers.get('location'));assert.equal(u.origin,'https://kauth.kakao.com');assert.equal(u.searchParams.get('redirect_uri'),'https://himawari.co.kr/api/auth/callback/kakao');assert.ok(u.searchParams.get('state'));assert.ok(r.headers.get('set-cookie'));
 delete process.env.KAKAO_LOGIN_ENABLED;
});
