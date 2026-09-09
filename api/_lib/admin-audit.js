import { createHash, randomUUID } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';
import { isAdminRequest, readAdminSession } from './auth.js';
import { isSameOrigin, json, readJson } from './http.js';

export async function ensureAuditSchema() {
  await database().query(`CREATE TABLE IF NOT EXISTS admin_audit (
    id text PRIMARY KEY, actor text NOT NULL, role text NOT NULL, action text NOT NULL,
    status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
  )`);
  await database().query("ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS target text, ADD COLUMN IF NOT EXISTS details jsonb");
}

// Records intent before a mutation and outcome afterwards. No secrets, request bodies or customer data.
export async function auditedAdminRequest(request, handler) {
  if (readAdminSession(request) && !isAdminRequest(request)) return json({ message: '이 작업에 대한 접근 권한이 없습니다.' }, 403);
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !isAdminRequest(request) || !isSameOrigin(request)) return handler(request);
  if (!databaseIsConfigured()) return json({ message: '변경 이력 저장소가 준비되지 않았습니다. 관리자에게 문의해 주세요.' }, 503);
  const id = randomUUID(); const principal = readAdminSession(request); const url = new URL(request.url);
  const action = `${request.method} ${url.pathname} ${(url.searchParams.get('route') || '').slice(0,80)}`;
  let input={};try{input=await readJson(request.clone(),300000);}catch{}
  if(!input || typeof input!=='object' || Array.isArray(input))input={};
  const target=String(input.id||input.orderNumber||(input.pathname?createHash('sha256').update(String(input.pathname)).digest('hex').slice(0,16):'')).slice(0,100);
  const details={fields:Object.keys(input).filter(k=>['id','orderNumber','status','price','stock','revision','naverDiscountRate','specs','relatedProductIds','options','optionName','image','gallery','highlights','description','tagline','url','updates','config'].includes(k))};
  for(const key of ['price','stock','revision','naverDiscountRate'])if(Number.isFinite(input[key]))details[key]=input[key];
  if(['received','reviewing','waiting_customer','resolved','payment_pending','confirmed','preparing','shipped','delivered','cancelled','refunded','cancel_requested','refund_requested'].includes(input.status))details.status=input.status;
  if(Array.isArray(input.updates))details.itemCount=input.updates.length;
  try { await ensureAuditSchema(); await database().query('INSERT INTO admin_audit(id,actor,role,action,status,target,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)', [id, principal.id, principal.role, action, 'pending', target, JSON.stringify(details)]); }
  catch { return json({ message: '변경 이력을 저장하지 못해 작업을 시작하지 않았습니다. 다시 시도해 주세요.' }, 503); }
  let response;
  try { response = await handler(request); }
  finally {
    await database().query('UPDATE admin_audit SET status=$1,finished_at=now() WHERE id=$2', [response?.ok ? 'success' : 'failed', id]).catch(() => console.error('admin_audit_finish_failed', { auditId: id }));
  }
  return response;
}
