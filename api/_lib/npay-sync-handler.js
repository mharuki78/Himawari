import { timingSafeEqual } from 'node:crypto';
import { isSameOrigin, json, methodNotAllowed, readJson } from './http.js';
import { createNpayOrderClient } from './npay-order-client.js';
import { runNpayOrderSync } from './npay-sync.js';
import {readNpayOrderCredentials} from './npay-credentials.js';
import {npayReviewRequestIsValid} from './npay.js';
import {syncNpaySandboxCheckout} from './npay-sandbox-checkout-sync.js';

export async function fetchNpaySync(request,{runSync=runNpayOrderSync}={}){
  if(!['GET','POST'].includes(request.method))return methodNotAllowed(['GET','POST']);
  const expected=process.env.NPAY_SYNC_SECRET||'';
  const received=request.headers.get('authorization')||'';
  const target='Bearer '+expected;
  if(expected.length<32||Buffer.byteLength(received)!==Buffer.byteLength(target)||!timingSafeEqual(Buffer.from(received),Buffer.from(target)))
    return json({message:'인증된 동기화 요청만 허용됩니다.'},403);
  if(process.env.NPAY_ORDER_SYNC_ENABLED!=='true')return json({message:'주문 동기화 개통 전입니다.'},503);
  let client;
  try{
    let scope;
    if(request.method==='POST'){
      if(process.env.VERCEL_ENV!=='preview'||process.env.NPAY_ORDER_API_ENV!=='sandbox'
        ||!isSameOrigin(request)||!npayReviewRequestIsValid(request))return json({message:'시험 주문 검증은 인증된 시험 환경에서만 허용됩니다.'},403);
      scope=await readJson(request,8192);
      if(!scope||typeof scope!=='object'||Array.isArray(scope)
        ||Object.keys(scope).some(key=>!['checkoutId','productOrderIds'].includes(key)))return json({message:'시험 주문의 조회 범위를 확인해 주세요.'},400);
    }
    const credentials=readNpayOrderCredentials();
    const environment=credentials.environment;
    client=createNpayOrderClient({...credentials,maxRequests:20});
    return json(scope?await syncNpaySandboxCheckout({...scope,request:client.request}):await runSync({environment,request:client.request}));
  }catch(error){return json({message:'주문 동기화를 완료하지 못했습니다. 재고 예약을 유지합니다.'},request.method==='POST'&&[400,403,404,409,413,415].includes(error?.status)?error.status:502);}
  finally{await client?.close();}
}
