import { database, databaseIsConfigured } from './database.js';
import {readNpayOrderCredentials} from './npay-credentials.js';
import {npaySyncPolicy} from './npay-sync-policy.js';

let schemaPromise;
export function evaluateNpayReadiness(proof,sync,{configured,environment,review=false,now=Date.now(),cadence='5m'}={}) {
  const closed={enabled:false,reason:'order_management_required'};
  const policy=npaySyncPolicy({NPAY_SYNC_CADENCE:cadence});
  if(!policy)return closed;
  if(!configured)return closed;
  if(environment==='sandbox')return review&&proof?.sandbox_testing===true?{enabled:true,reason:null}:closed;
  if(environment!=='production'||proof?.enabled!==true)return closed;
  if((proof.sync_cadence??'5m')!==policy.cadence)return closed;
  const validDate=value=>{const t=new Date(value??NaN).getTime();return Number.isFinite(t)&&t<=now;};
  if(!['sandbox_verified_at','provider_approved_at','cutover_verified_at','polling_capacity_verified_at'].every(k=>validDate(proof[k])))return closed;
  if(!sync||sync.incident_count!==0||sync.legacy_order_incident===true||![sync.last_success_at,sync.through_at].every(v=>validDate(v)&&now-new Date(v).getTime()<=policy.maxAgeMs))return closed;
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
    polling_capacity_verified_at timestamptz,
    sync_cadence text NOT NULL DEFAULT '5m' CHECK(sync_cadence IN ('5m','4h'))
  )`.then(()=>database()`ALTER TABLE npay_integration_release ADD COLUMN IF NOT EXISTS sync_cadence text NOT NULL DEFAULT '5m' CHECK(sync_cadence IN ('5m','4h'))`)
    .catch(error=>{schemaPromise=undefined;throw error;});
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
  const policy=npaySyncPolicy();
  if(!policy)return{...unavailable,legacyBlocked};
  let sync;
  try{[sync]=await sql`SELECT last_success_at,through_at,incident_count,
    COALESCE((to_jsonb(s)->>'legacy_order_incident')::boolean,false) AS legacy_order_incident
    FROM npay_sync_state s WHERE environment=${environment}`;}
  catch(error){if(error.code!=='42P01')throw error;}
  const credentials=readNpayOrderCredentials();
  const configured=credentials.environment===environment&&Boolean(credentials.clientId&&credentials.clientSecret
    &&credentials.proxyUrl&&process.env.NPAY_SYNC_SECRET&&/^[A-Za-z0-9+/]{43}=$/.test(process.env.NPAY_RESERVATION_ENCRYPTION_KEY||''));
  return{...evaluateNpayReadiness(proof,sync,{configured,environment,review,cadence:policy.cadence}),legacyBlocked};
}
