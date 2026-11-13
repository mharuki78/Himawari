import { database } from './database.js';
import { randomUUID } from 'node:crypto';
import { ensureOrderSchema } from './orders.js';
import { collectNpayChanges, readNpayOrderMetadata } from './npay-order-feed.js';
import { ensureNpaySettlementSchema, reconcileNpayOrderMetadata } from './npay-settlement.js';

let schemaPromise;
export async function ensureNpaySyncSchema() {
  if(!schemaPromise) schemaPromise=ensureOrderSchema().then(ensureNpaySettlementSchema).then(()=>{const sql=database();return sql.transaction([sql`CREATE TABLE IF NOT EXISTS npay_sync_state (
    environment text PRIMARY KEY CHECK(environment IN ('sandbox','production')),
    through_at timestamptz,
    last_success_at timestamptz,
    last_attempt_at timestamptz,
    incident_count integer NOT NULL DEFAULT 0,
    revision integer NOT NULL DEFAULT 0,
    lease_owner text,
    lease_until timestamptz
  )`,sql`ALTER TABLE npay_sync_state ADD COLUMN IF NOT EXISTS lease_owner text`,
  sql`ALTER TABLE npay_sync_state ADD COLUMN IF NOT EXISTS lease_until timestamptz`]);}).catch(error=>{schemaPromise=undefined;throw error;});
  return schemaPromise;
}

// Server-only. request is an authenticated mall transport. Personal response
// fields exist only inside the reader; only validated settlement metadata persists.
export async function runNpayOrderSync({environment,request,now=new Date(),maxPages=3}={}) {
  if(!['sandbox','production'].includes(environment)||typeof request!=='function'||!Number.isFinite(now.getTime()))
    throw Object.assign(new Error('Invalid Npay synchronization settings.'),{status:400});
  await ensureNpaySyncSchema();
  const sql=database();
  await sql`INSERT INTO npay_sync_state(environment) VALUES(${environment}) ON CONFLICT(environment) DO NOTHING`;
  const owner=randomUUID();
  const [state]=await sql`UPDATE npay_sync_state SET lease_owner=${owner},lease_until=now()+interval '10 minutes'
    WHERE environment=${environment} AND (lease_until IS NULL OR lease_until<now()) RETURNING *`;
  if(!state)throw Object.assign(new Error('네이버페이 주문 동기화가 이미 진행 중입니다.'),{status:409});
  try{
  const nowTime=now.getTime();
  if(state.through_at&&new Date(state.through_at).getTime()>nowTime)throw Object.assign(new Error('Npay synchronization clock moved backwards.'),{status:409});
  const [oldest]=await sql`SELECT min(created_at) AS created_at FROM npay_checkouts WHERE environment=${environment}`;
  const initial=oldest.created_at?Math.min(nowTime-3600_000,new Date(oldest.created_at).getTime()-60_000):nowTime-3600_000;
  const from=state.through_at?new Date(state.through_at).getTime()-3600_000:initial;
  const end=Math.min(nowTime,from+86400_000);
    const changes=await collectNpayChanges({from:new Date(from).toISOString(),to:new Date(end).toISOString(),request,maxPages});
    const details=await readNpayOrderMetadata({productOrderIds:changes.productOrderIds,request});
    const settled=await reconcileNpayOrderMetadata(details.orders,{environment});
    const missing=details.missingProductOrderIds.length;
    const incidents=settled.incidents.length+missing+(changes.coverageComplete?0:1);
    const success=incidents===0&&changes.through!==null;
    const updated=await sql`UPDATE npay_sync_state SET through_at=CASE WHEN ${success} THEN ${changes.through}::timestamptz ELSE through_at END,
      last_success_at=CASE WHEN ${success} THEN ${now.toISOString()}::timestamptz ELSE last_success_at END,
      last_attempt_at=${now.toISOString()},incident_count=${incidents},revision=revision+1
      WHERE environment=${environment} AND revision=${state.revision} AND lease_owner=${owner} RETURNING revision`;
    if(!updated.length&&incidents>0)await sql`UPDATE npay_sync_state SET incident_count=incident_count+${incidents},revision=revision+1
      WHERE environment=${environment}`;
    return {bound:settled.bound,updated:settled.updated,ignored:settled.ignored,incidents:incidents,
      missing,changeCount:changes.changes.length,cursorAdvanced:success&&updated.length===1,collectionFinal:false};
  }catch(error){
    await sql`UPDATE npay_sync_state SET last_attempt_at=${now.toISOString()},incident_count=incident_count+1,revision=revision+1
      WHERE environment=${environment}`;
    if(error?.status===409)throw error;
    throw Object.assign(new Error('네이버페이 주문 동기화를 완료하지 못했습니다. 재고 예약을 유지합니다.'),{status:502});
  }finally{await sql`UPDATE npay_sync_state SET lease_owner=NULL,lease_until=NULL WHERE environment=${environment} AND lease_owner=${owner}`;}
}
