import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createProductCsvSandbox } from './helpers/product-csv-sandbox.js';

test('retrying an uncertain product registration with the same request ID creates exactly one product', async () => {
  const sandbox=await createProductCsvSandbox([]);
  try {
    const requestId=randomUUID();
    const pathname=`product-media/${requestId}/main.png`;
    const image=`https://fixture.public.blob.vercel-storage.com/${pathname}`;
    sandbox.state.blobs.set(pathname,{body:'fixture-image',etag:'image-v1',contentType:'image/png',size:68});
    const input={requestId,name:'업로드 재시도 검증 백팩',model:'No.QA',naverPrice:99000,stock:10,
      tagline:'이미지 업로드와 중복 등록 방지 검증',description:'입력 내용과 업로드 파일을 유지한 상태에서 같은 등록 요청을 다시 확인합니다.',highlights:['재시도 검증용'],
      url:'https://smartstore.naver.com/baegot/products/123456789',image,gallery:[],managedImages:[image],options:[]};
    const request=()=>new Request('https://csv-fixture.invalid/api/admin/products',{method:'POST',headers:{origin:'https://csv-fixture.invalid',cookie:sandbox.cookie,'content-type':'application/json'},body:JSON.stringify(input)});
    const first=await sandbox.handler(request());
    assert.equal(first.status,201,JSON.stringify(await first.clone().json()));
    const created=await first.json();
    const retry=await sandbox.handler(request());
    assert.equal(retry.status,200);
    const repeated=await retry.json();
    assert.equal(repeated.duplicate,true);
    assert.equal(repeated.product.id,created.product.id);
    assert.equal(sandbox.state.writes,1);
    assert.equal(sandbox.products.length,1);
  }finally{await sandbox.close();}
});
