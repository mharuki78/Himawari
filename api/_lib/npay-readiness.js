import { database, databaseIsConfigured } from './database.js';
import {readNpayOrderCredentials} from './npay-credentials.js';

let schemaPromise;
export function evaluateNpayReadiness(proof,sync,{configured,environment,review=false,now=Date.now()}={}) {
  const closed={enabled:false,reason:'order_management_required'};
  if(!configured)return closed;
  if(environment==='sandbox')return review&&proof?.sandbox_testing===true?{enabled:true,reason:null}:closed;
  if(environment!=='production'||proof?.enabled!==true)return closed;
  const validDate=value=>{const t=new Date(value??NaN).getTime();return Number.isFinite(t)&&t<=now;};
  if(!['sandbox_verified_at','provider_approved_at','cutover_verified_at','polling_capacity_verified_at'].every(k=>validDate(proof[k])))return closed;
  if(!sync||sync.incident_count!==0||![sync.last_success_at,sync.through_at].every(v=>validDate(v)&&now-new Date(v).getTime()<=600_000))return closed;
  return{enabled:true,reason:null};
}

export function ensureNpayReadinessSchema(){
  if(!schemaPromise)schemaPromise=database()`CREATE TABLE IF NOT EXISTS npay_integration_release (
    environment text PRIMARY KEY CHECK(environment IN ('sandbox','production')),
    sandbox_testing boolean NOT NULL DEFAULT false,
    enabled boolean NOT NULL DEFAULT false,
    sandbox_verified_at timestamptz,
    provider_approved_at timestamptz,
    cutover_verified_at timestamptz,
    polling_capacity_verified_at timestamptz
  )`.catch(error=>{schemaPromise=undefined;throw error;});
  return schemaPromise;
}

export async function npayIntegrationReadiness({review=false,environment=review?'sandbox':'production'}={}){
  const required=process.env.NPAY_MANAGED_CHECKOUT_REQUIRED==='true';
  const unavailable={enabled:false,reason:'order_management_required',legacyBlocked:required};
  if(!databaseIsConfigured())return unavailable;
  await ensureNpayReadinessSchema();
  const sql=database();
  const [proof]=await sql`SELECT * FROM npay_integration_release WHERE environment=${environment}`;
  const legacyBlocked=required||environment==='production'&&Boolean(proof?.cutover_verified_at);
  let sync;
  try{[sync]=await sql`SELECT last_success_at,through_at,incident_count FROM npay_sync_state WHERE environment=${environment}`;}
  catch(error){if(error.code!=='42P01')throw error;}
  const credentials=readNpayOrderCredentials();
  const configured=credentials.environment===environment&&Boolean(credentials.clientId&&credentials.clientSecret
    &&credentials.proxyUrl&&process.env.NPAY_SYNC_SECRET&&/^[A-Za-z0-9+/]{43}=$/.test(process.env.NPAY_RESERVATION_ENCRYPTION_KEY||''));
  return{...evaluateNpayReadiness(proof,sync,{configured,environment,review}),legacyBlocked};
}
