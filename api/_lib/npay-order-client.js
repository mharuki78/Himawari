import bcrypt from 'bcryptjs';
import { ProxyAgent, request as httpRequest } from 'undici';

const ORIGINS = { sandbox:'https://sandbox-api.pay.naver.com/npay/partner',production:'https://api.pay.naver.com/npay/partner' };
const CHANGES='/v1/pay-order/mall/product-orders/last-changed-statuses';
const DETAILS='/v1/pay-order/mall/product-orders/query';
const error = (status=502) => Object.assign(new Error('네이버페이 주문 동기화 연결을 확인해 주세요.'),{status});

export function createNpayOrderClient({environment,clientId,clientSecret,proxyUrl,clock=Date.now,maxRequests=20,send}={}) {
  if(!ORIGINS[environment]||typeof clientId!=='string'||!clientId||bcrypt.truncates(`${clientId}_${clock()}`)
    ||!/^\$2[aby]\$(0[4-9]|1[0-4])\$[./A-Za-z0-9]{22}$/.test(clientSecret||'')
    ||!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>1000)throw error(503);
  let proxy;
  try{proxy=new URL(proxyUrl);}catch{throw error(503);}
  if(!['http:','https:'].includes(proxy.protocol)||!proxy.username||!proxy.password||!/^[a-z0-9-]+\.usefixie\.com$/i.test(proxy.hostname)
    ||proxy.pathname!=='/'||proxy.search||proxy.hash)throw error(503);
  proxy.protocol='https:';proxy.port='443';
  let agent,token,expiresAt=0,authPromise,attempts=0,closed=false;
  const origin=ORIGINS[environment];
  const wire=send||async function(url,options){
    agent ||= new ProxyAgent({uri:proxy.href,connections:1,allowH2:false,maxResponseSize:2_000_000,
      proxyTls:{rejectUnauthorized:true,minVersion:'TLSv1.2',timeout:5000},requestTls:{rejectUnauthorized:true,minVersion:'TLSv1.2',timeout:5000}});
    const {proxyUrl:_proxy,...init}=options;
    const response=await httpRequest(url,{...init,dispatcher:agent,idempotent:false,headersTimeout:10_000,bodyTimeout:5000});
    if(response.statusCode!==200){await response.body.dump({limit:2_000_000});throw error();}
    return{status:response.statusCode,payload:await response.body.json()};
  };
  async function transmit(path,options){
    if(closed||attempts>=maxRequests)throw error(503);
    attempts++;
    try{
      const result=await wire(origin+path,{...options,proxyUrl:proxy.href,maxRedirections:0,signal:AbortSignal.timeout(15_000)});
      if(result?.status!==200||!result.payload||typeof result.payload!=='object')throw error();
      return result.payload;
    }catch(e){if(e?.status===503)throw e;throw error();}
  }
  async function authenticate(){
    if(token&&clock()<expiresAt)return token;
    if(authPromise)return authPromise;
    authPromise=(async()=>{
      const timestamp=String(clock()),signature=Buffer.from(await bcrypt.hash(`${clientId}_${timestamp}`,clientSecret)).toString('base64');
      const payload=await transmit('/v1/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},
        body:new URLSearchParams({client_id:clientId,timestamp,grant_type:'client_credentials',client_secret_sign:signature,type:'SELF'}).toString()});
      if(typeof payload.access_token!=='string'||!payload.access_token||/[\r\n]/.test(payload.access_token)||payload.access_token.length>4096
        ||!Number.isSafeInteger(payload.expires_in)||payload.expires_in<=0)throw error();
      token=payload.access_token;expiresAt=clock()+Math.max(0,Math.min(payload.expires_in,10800)*1000-60_000);
      return token;
    })().finally(()=>{authPromise=undefined;});
    return authPromise;
  }
  return{
    async request(path,{method='GET',body}={}){
      if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.length>16_384)throw error(400);
      const url=new URL(origin+path);
      if(url.origin!==new URL(origin).origin||url.hash||!((url.pathname==='/npay/partner'+CHANGES&&method==='GET'&&!body)
        ||(url.pathname==='/npay/partner'+DETAILS&&method==='POST'&&body&&typeof body==='object'&&!Array.isArray(body))))throw error(400);
      const accessToken=await authenticate();
      const headers={authorization:'Bearer '+accessToken,accept:'application/json'};
      if(body)headers['content-type']='application/json';
      return transmit(path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
    },
    async close(){closed=true;token=undefined;expiresAt=0;await agent?.close();},
  };
}
