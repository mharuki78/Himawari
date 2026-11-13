import { neon } from '@neondatabase/serverless';
import { readReservedNpayProducts } from './npay-reservations.js';

let client,connection;
export function validateSandboxDatabase(primary,sandbox){
  try{
    const a=new URL(primary),b=new URL(sandbox);
    const host=url=>url.hostname.replace(/-pooler(?=\.)/,'');
    if(!['postgres:','postgresql:'].includes(b.protocol)||!b.password||!b.pathname||b.pathname==='/'
      ||host(a)===host(b)&&a.pathname===b.pathname)throw new Error();
    return true;
  }catch{throw Object.assign(new Error('운영과 분리된 시험 데이터베이스가 필요합니다.'),{status:503});}
}

// Npay calls the merchant's registered product-info URL even for its sandbox.
// Serve only unpredictable reserved product aliases from a separate empty test
// database. Never point test order creation at the production inventory store.
export async function readSandboxReservedNpayProducts(ids){
  const configured=process.env.NPAY_SANDBOX_DATABASE_URL;
  if(!configured||!ids.length)return[];
  validateSandboxDatabase(process.env.DATABASE_URL,configured);
  if(!client||connection!==configured){client=neon(configured);connection=configured;}
  return readReservedNpayProducts(ids,{sql:client,prepareSchema:false,loadCampaign:async()=>{
    const [row]=await client`SELECT * FROM black_friday_campaign WHERE singleton`;
    if(!row)return{items:[]};
    return{id:row.id,revision:row.revision,enabled:row.enabled,startsAt:row.starts_at?.toISOString?.()??row.starts_at,
      endsAt:row.ends_at?.toISOString?.()??row.ends_at,items:row.items};
  }});
}
