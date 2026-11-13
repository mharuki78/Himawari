import {createPrivateKey,privateDecrypt,constants} from 'node:crypto';

export function decryptSandboxEnvelope(value,env=process.env){
  try{
    if(env.VERCEL_ENV==='production'||env.NPAY_ORDER_API_ENV!=='sandbox')throw new Error();
    const key=createPrivateKey({key:Buffer.from(env.NPAY_SANDBOX_CREDENTIAL_PRIVATE_KEY,'base64'),format:'der',type:'pkcs8'});
    return JSON.parse(privateDecrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(value,'base64')).toString());
  }catch{throw Object.assign(new Error('네이버페이 시험 환경의 보안 설정을 확인해 주세요.'),{status:503});}
}

export function sandboxReviewToken(env=process.env){
  if(!env.NPAY_SANDBOX_REVIEW_ENVELOPE)return env.NPAY_REVIEW_TOKEN;
  const decoded=decryptSandboxEnvelope(env.NPAY_SANDBOX_REVIEW_ENVELOPE,env);
  if(decoded.type!=='sandbox-review'||typeof decoded.token!=='string'||! /^[a-f0-9]{64}$/.test(decoded.token))throw Object.assign(new Error('Invalid sandbox access configuration.'),{status:503});
  return decoded.token;
}

// The approved browser-to-Vercel transfer never returns plaintext credentials
// through chat/tool output. Envelopes and private key are separate sensitive
// preview-only settings; decryption occurs only inside the server process.
export function readNpayOrderCredentials(env=process.env){
  const environment=env.NPAY_ORDER_API_ENV;
  const encrypted=env.NPAY_SANDBOX_NPAY_ENVELOPE||env.NPAY_SANDBOX_FIXIE_ENVELOPE||env.NPAY_SANDBOX_CREDENTIAL_PRIVATE_KEY;
  if(!encrypted)return{environment,clientId:env.NPAY_ORDER_CLIENT_ID,clientSecret:env.NPAY_ORDER_CLIENT_SECRET,proxyUrl:env.NPAY_ORDER_PROXY_URL};
  try{
    if(environment!=='sandbox')throw new Error();
    const npay=decryptSandboxEnvelope(env.NPAY_SANDBOX_NPAY_ENVELOPE,env),fixie=decryptSandboxEnvelope(env.NPAY_SANDBOX_FIXIE_ENVELOPE,env);
    if(!npay.clientId||!npay.clientSecret||!fixie.fixieUrl)throw new Error();
    return{environment,clientId:npay.clientId,clientSecret:npay.clientSecret,proxyUrl:fixie.fixieUrl};
  }catch{throw Object.assign(new Error('네이버페이 시험 환경의 보안 설정을 확인해 주세요.'),{status:503});}
}
