import { kakaopayConfig } from './kakaopay-client.js';
import { kakaopay } from './kakaopay.js';
import { getMember } from './member-auth.js';
import { isSameOrigin, json, methodNotAllowed, readJson } from './http.js';

export async function fetchKakaopay(request, route) {
  const headers = { 'Referrer-Policy':'no-referrer', Vary:'Cookie' };
  if (route==='kakaopay-config') {
    if (request.method!=='GET') return methodNotAllowed(['GET']);
    return json({enabled:kakaopayConfig().enabled},200,headers);
  }
  if (request.method!=='POST') return methodNotAllowed(['POST']);
  try {
    if (!isSameOrigin(request)) return json({message:'요청 출처를 확인할 수 없습니다.'},403,headers);
    const body = await readJson(request,65_536);
    if (route==='kakaopay-ready') return json(await kakaopay.ready(await getMember(request),body),200,headers);
    if (route==='kakaopay-finish') return json(await kakaopay.finish(body.orderId,body.state,body.pgToken),200,headers);
    if (route==='kakaopay-abandon') return json(await kakaopay.abandon(body.orderId,body.state),200,headers);
    if (route==='kakaopay-status') return json(await kakaopay.status(body.orderId,body.state),200,headers);
    return json({message:'결제 경로를 찾을 수 없습니다.'},404,headers);
  } catch (error) {
    const status = Number(error.status) || 500;
    return json({message:status<500 ? error.message : (status===503 ? '카카오페이 결제 연결을 준비하고 있습니다.' : '결제 결과를 확인하지 못했습니다. 같은 주문에서 다시 확인해 주세요.'),fieldErrors:error.fieldErrors || {}},status,headers);
  }
}
