import { randomUUID } from 'node:crypto';
import { database } from './database.js';
import { ensureOrderSchema, readOrderById, inventoryLimitsForOrder } from './orders.js';
import { ensureCouponSchema } from './coupon-claims.js';
import { CONFIRM_ORDER_SQL } from './order-transactions.js';

export const PAYMENT_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS kakaopay_payments (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  cid text NOT NULL, partner_user_id text NOT NULL, tid text UNIQUE,
  phase text NOT NULL DEFAULT 'new' CHECK (phase IN ('new','ready','approving','paid','cancelling','refunded','closed')),
  redirect_pc text, redirect_mobile text, lease_until timestamptz, approval_started boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
  approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
)`;

export const ACQUIRE_PAYMENT_SQL = `UPDATE kakaopay_payments SET phase=$2,lease_until=now()+interval '60 seconds',updated_at=now()
 WHERE order_id=$1 AND phase=ANY($3::text[]) AND (lease_until IS NULL OR lease_until<now()) RETURNING *`;

export const SETTLE_PAYMENT_SQL = `WITH payment AS (
 UPDATE kakaopay_payments SET phase='paid',approved_at=now(),lease_until=NULL,updated_at=now()
 WHERE order_id=$1 AND phase='approving' RETURNING order_id
), changed AS (
 UPDATE orders o SET status=CASE WHEN o.status='payment_pending' THEN 'confirmed' ELSE o.status END,
 revision=revision+1,updated_at=now() FROM payment p WHERE o.id=p.order_id RETURNING o.id,o.status
), event AS (
 INSERT INTO order_events(id,order_id,actor,from_status,to_status,note)
 SELECT $2,id,'system',CASE WHEN status='cancel_requested' THEN 'confirmed' ELSE 'payment_pending' END,status,'카카오페이 결제 승인 확인' FROM changed RETURNING order_id
) SELECT order_id FROM event`;

export const CLOSE_PAYMENT_SQL = `WITH changed AS (
 UPDATE orders o SET status='cancelled',revision=revision+1,updated_at=now()
 WHERE o.id=$1 AND o.status IN ('payment_pending','cancel_requested') AND EXISTS (
 SELECT 1 FROM kakaopay_payments p WHERE p.order_id=o.id AND p.phase IN ('new','ready','approving')) RETURNING id
), payment AS (
 UPDATE kakaopay_payments p SET phase='closed',lease_until=NULL,updated_at=now() FROM changed c WHERE p.order_id=c.id RETURNING p.order_id
), coupons AS (
 UPDATE coupon_claims c SET used_at=NULL,order_id=NULL FROM changed o WHERE c.order_id=o.id RETURNING c.id
), stock AS (
 UPDATE inventory_reservations r SET active=false,updated_at=now() FROM changed o WHERE r.order_id=o.id RETURNING r.order_id
), event AS (
 INSERT INTO order_events(id,order_id,actor,from_status,to_status,note) SELECT $2,id,'system','payment_pending','cancelled','카카오페이 결제 미완료 · 주문 종료' FROM changed RETURNING order_id
) SELECT order_id FROM event`;

let schemaPromise;
export async function ensurePaymentSchema() {
  if (!schemaPromise) schemaPromise = ensureOrderSchema().then(() => database().query(PAYMENT_SCHEMA_SQL)).catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

export const paymentStore = {
  async insert(id, cid, partnerUserId) {
    await ensurePaymentSchema();
    await database().query(`INSERT INTO kakaopay_payments(order_id,cid,partner_user_id) VALUES($1,$2,$3) ON CONFLICT(order_id) DO NOTHING`, [id,cid,partnerUserId]);
  },
  async get(id) {
    await ensurePaymentSchema();
    const rows = await database().query(`SELECT p.*,o.order_number,o.total,o.status AS order_status,o.revision
      FROM kakaopay_payments p JOIN orders o ON o.id=p.order_id WHERE p.order_id=$1`, [id]);
    return rows[0] || null;
  },
  async acquire(id, phase, from) {
    return (await database().query(ACQUIRE_PAYMENT_SQL, [id,phase,from]))[0] || null;
  },
  async release(id) { await database().query('UPDATE kakaopay_payments SET lease_until=NULL WHERE order_id=$1',[id]); },
  async markApproval(id) { await database().query('UPDATE kakaopay_payments SET approval_started=true WHERE order_id=$1',[id]); },
  async ready(id, result) {
    await database().query(`UPDATE kakaopay_payments SET tid=$2,redirect_pc=$3,redirect_mobile=$4,phase='ready',lease_until=NULL,updated_at=now() WHERE order_id=$1 AND phase='new'`,[id,result.tid,result.pc,result.mobile]);
  },
  async reserve(session) {
    const limits = await inventoryLimitsForOrder(session.order_id);
    const [,rows] = await database().transaction([
      database().query("SELECT pg_advisory_xact_lock(hashtext('himawari_inventory'))"),
      database().query(CONFIRM_ORDER_SQL.replace("'admin'","'system'"), ['payment_pending',null,session.order_number,session.revision,'payment_pending',randomUUID(),'카카오페이 승인 전 재고 예약',JSON.stringify(limits),session.order_id]),
    ], {isolationLevel:'ReadCommitted'});
    if (!rows.length) throw Object.assign(new Error('상품 재고 또는 주문 상태가 변경되어 결제할 수 없습니다. 주문 내역을 확인해 주세요.'), {status:409});
  },
  async paid(id) { return Boolean((await database().query(SETTLE_PAYMENT_SQL,[id,randomUUID()])).length); },
  async refunded(id) { await database().query("UPDATE kakaopay_payments SET phase='refunded',lease_until=NULL,updated_at=now() WHERE order_id=$1",[id]); },
  async void(id) { await database().query("UPDATE kakaopay_payments SET phase='closed',lease_until=NULL,updated_at=now() WHERE order_id=$1",[id]); },
  async close(id) {
    await ensureCouponSchema();
    // Only invoked after the provider proves no payment, or before an approval was ever attempted.
    return (await database().query(CLOSE_PAYMENT_SQL,[id,randomUUID()])).length > 0;
  },
  async cancelPendingPayment(id) {
    await ensureCouponSchema();
    // Provider proves a full refund before an interrupted approval was recorded locally.
    const text=CLOSE_PAYMENT_SQL.replace("phase='closed'","phase='refunded'").replace('카카오페이 결제 미완료 · 주문 종료','카카오페이 전액 취소 확인');
    return (await database().query(text,[id,randomUUID()])).length > 0;
  },
  order: readOrderById,
};
