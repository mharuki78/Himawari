import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { uploadProductImage, runProductRequest } from '../admin/product-network.js';

test('CSP permits the installed Blob SDK upload API without allowing arbitrary connections', async () => {
  const config=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  const policy=config.headers.find(item=>item.source==='/(.*)').headers.find(item=>item.key==='Content-Security-Policy').value;
  const connect=policy.split(';').find(item=>item.trim().startsWith('connect-src ')).trim().split(/\s+/).slice(1);
  assert.ok(connect.includes('https://vercel.com/api/blob/'));
  assert.ok(!connect.includes('*'));
  assert.ok(!connect.includes('https:'));
  assert.match(policy,/object-src 'none'/);
});

test('a stalled upload rejects promptly even if the SDK ignores cancellation', async () => {
  let signal;
  await assert.rejects(uploadProductImage((_path,_file,options)=>{signal=options.abortSignal;return new Promise(()=>{});},'bag.webp',new Blob(['test']),{}, {idleMs:15,maxMs:100}),{name:'TimeoutError'});
  assert.equal(signal.aborted,true);
});

test('manual cancellation remains AbortError and aborts the SDK request', async () => {
  const controller=new AbortController();let signal;
  const operation=uploadProductImage((_path,_file,options)=>{signal=options.abortSignal;return new Promise(()=>{});},'bag.webp',new Blob(['test']),{abortSignal:controller.signal},{idleMs:100,maxMs:200});
  controller.abort();
  await assert.rejects(operation,{name:'AbortError'});
  assert.equal(signal.aborted,true);
});

test('upload progress extends the idle deadline and successful results retain the SDK URL', async () => {
  const result=await uploadProductImage((_path,_file,options)=>new Promise(resolve=>{
    setTimeout(()=>options.onUploadProgress({loaded:1,total:2,percentage:50}),15);
    setTimeout(()=>resolve({url:'https://example.com/bag.webp'}),45);
  }),'bag.webp',new Blob(['test']),{}, {idleMs:35,maxMs:100});
  assert.equal(result.url,'https://example.com/bag.webp');
});

test('the total upload deadline bounds retries even while byte counts advance', async () => {
  const timers=[];
  try {
    await assert.rejects(uploadProductImage((_path,_file,options)=>new Promise(()=>{
      for(let i=1;i<6;i++)timers.push(setTimeout(()=>options.onUploadProgress({loaded:i,total:20,percentage:i*5}),i*10));
    }),'bag.webp',new Blob(['test']),{}, {idleMs:40,maxMs:35}),{name:'TimeoutError'});
  }finally{timers.forEach(clearTimeout);}
});

test('a stalled temporary-media cleanup is bounded and successful responses are retained', async () => {
  let signal;
  await assert.rejects(runProductRequest(value=>{signal=value;return new Promise(()=>{});},{timeoutMs:15}),{name:'TimeoutError'});
  assert.equal(signal.aborted,true);
  assert.deepEqual(await runProductRequest(async()=>({duplicate:true})),{duplicate:true});
});

test('SDK retry progress still counts when the byte counter restarts below its previous peak', async () => {
  const result=await uploadProductImage((_path,_file,options)=>new Promise(resolve=>{
    setTimeout(()=>options.onUploadProgress({loaded:8,total:10,percentage:80}),15);
    setTimeout(()=>options.onUploadProgress({loaded:2,total:10,percentage:20}),35);
    setTimeout(()=>resolve({url:'https://example.com/retried.webp'}),65);
  }),'bag.webp',new Blob(['test']),{}, {idleMs:35,maxMs:150});
  assert.equal(result.url,'https://example.com/retried.webp');
});

test('late SDK progress after cancellation cannot alter a recovered form', async () => {
  const controller=new AbortController();let report,updates=0;
  const pending=uploadProductImage((_path,_file,options)=>{report=options.onUploadProgress;return new Promise(()=>{});},'bag.webp',new Blob(['test']),{abortSignal:controller.signal,onUploadProgress:()=>updates++});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
  report({loaded:1,total:1,percentage:100});
  assert.equal(updates,0);
});
