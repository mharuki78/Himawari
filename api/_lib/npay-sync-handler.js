import { timingSafeEqual } from 'node:crypto';
import { json, methodNotAllowed } from './http.js';
import { createNpayOrderClient } from './npay-order-client.js';
import { runNpayOrderSync } from './npay-sync.js';
import {readNpayOrderCredentials} from './npay-credentials.js';

export async function fetchNpaySync(request){
  if(request.method!=='GET')return methodNotAllowed(['GET']);
  const expected=process.env.NPAY_SYNC_SECRET||'';
  const received=request.headers.get('authorization')||'';
  const target='Bearer '+expected;
  if(expected.length<32||Buffer.byteLength(received)!==Buffer.byteLength(target)||!timingSafeEqual(Buffer.from(received),Buffer.from(target)))
    return json({message:'인증된 동기화 요청만 허용됩니다.'},403);
  if(process.env.NPAY_ORDER_SYNC_ENABLED!=='true')return json({message:'주문 동기화 개통 전입니다.'},503);
  let client;
  try{
    const credentials=readNpayOrderCredentials();
    const environment=credentials.environment;
    client=createNpayOrderClient({...credentials,maxRequests:20});
    return json(await runNpayOrderSync({environment,request:client.request}));
  }catch{return json({message:'주문 동기화를 완료하지 못했습니다. 재고 예약을 유지합니다.'},502);}
  finally{await client?.close();}
}
