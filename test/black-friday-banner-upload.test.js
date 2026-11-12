import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createSessionCookie } from '../api/_lib/auth.js';

test('banner upload tokens require admin and same origin, enforce isolated paths and restrict type/size', async () => {
  const keys = ['ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'PRODUCT_BLOB_READ_WRITE_TOKEN'];
  const previous = keys.map(key => process.env[key]);
  Object.assign(process.env, { ADMIN_PASSWORD_HASH:'fixture',ADMIN_SESSION_SECRET:'banner-fixture-only-'.repeat(4),PRODUCT_BLOB_READ_WRITE_TOKEN:'fixture' });
  const output = new URL(`../backups/banner-token-${randomUUID()}.mjs`, import.meta.url);
  try {
    const compiled = await build({entryPoints:['api/admin/product-upload.js'],bundle:true,platform:'node',format:'esm',packages:'external',write:false,
      plugins:[{name:'token-constraints',setup(build){build.onResolve({filter:/^@vercel\/blob\/client$/},()=>({path:'client',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export async function handleUpload({body,onBeforeGenerateToken}){return {constraints:await onBeforeGenerateToken(body.payload.pathname,body.payload.clientPayload)}}',loader:'js'}));}}]});
    await mkdir(new URL('../backups/',import.meta.url),{recursive:true});
    await writeFile(output,compiled.outputFiles[0].contents);
    const {fetch:handler}=await import(output.href);
    const origin='https://banner-fixture.invalid';
    const cookie=createSessionCookie(new Request(origin)).split(';')[0];
    const requestId=randomUUID();
    const request=(pathname,headers={})=>new Request(origin+'/api/admin/product-upload',{method:'POST',headers:{origin,cookie,'content-type':'application/json',...headers},body:JSON.stringify({type:'blob.generate-client-token',payload:{pathname,clientPayload:JSON.stringify({requestId,kind:'black-friday-banner'})}})});
    const path=`black-friday-banners/${requestId}/banner.jpg`;
    assert.equal((await handler(request(path,{cookie:''}))).status,401);
    assert.equal((await handler(request(path,{origin:'https://foreign.invalid'}))).status,403);
    for(const foreign of [path.replace(requestId,randomUUID()),path.replace('black-friday-banners','product-media'),path.replace('.jpg','.html')]) assert.equal((await handler(request(foreign))).status,400);
    const response=await handler(request(path));assert.equal(response.status,200);
    const {constraints}=await response.json();
    assert.deepEqual(constraints.allowedContentTypes,['image/jpeg','image/png','image/webp','image/avif']);
    assert.equal(constraints.maximumSizeInBytes,8*1024*1024);
    assert.equal(constraints.allowOverwrite,false);assert.equal(constraints.addRandomSuffix,true);
    assert.ok(constraints.validUntil>Date.now()&&constraints.validUntil<=Date.now()+15*60000);
  }finally{
    for(let i=0;i<keys.length;i++){if(previous[i]===undefined)delete process.env[keys[i]];else process.env[keys[i]]=previous[i];}
    await unlink(output).catch(()=>{});
  }
});
