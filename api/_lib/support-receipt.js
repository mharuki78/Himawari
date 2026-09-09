import { createHmac, timingSafeEqual } from 'node:crypto';
const ID=/^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function key(){return process.env.SUPPORT_RECEIPT_SECRET || process.env.ADMIN_SESSION_SECRET;}
export function createSupportReceipt(requestId, now=Date.now()) {
  if(!ID.test(requestId)||!key()||key().length<32)return '';
  const payload=Buffer.from(JSON.stringify({id:requestId,exp:now+30*86400000})).toString('base64url');
  return `${payload}.${createHmac('sha256',key()).update(payload).digest('base64url')}`;
}
export function readSupportReceipt(token,now=Date.now()) {
  if(typeof token!=='string'||token.length>1000||!key())return null;
  const [payload,signature,...rest]=token.split('.');if(!payload||!signature||rest.length)return null;
  const expected=createHmac('sha256',key()).update(payload).digest();const actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return ID.test(data.id)&&Number.isFinite(data.exp)&&data.exp>now ? data.id:null;}catch{return null;}
}
