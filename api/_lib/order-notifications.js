import { bankTransfer } from '../../assets/bank-transfer.js';
import { CLAIM_NOTIFICATION_RETRIES } from './notification-queue.js';
import { randomUUID } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';

function configured() { return Boolean(databaseIsConfigured() && process.env.RESEND_API_KEY && (process.env.ORDER_FROM_EMAIL || process.env.RESTOCK_FROM_EMAIL)); }
function html(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
export async function ensureNotificationSchema() {
  const sql = database();
  await sql.query(`CREATE TABLE IF NOT EXISTS order_notifications (
    id text PRIMARY KEY, order_number text NOT NULL, event_type text NOT NULL, revision integer NOT NULL,
    status text NOT NULL DEFAULT 'pending', error_message text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
    UNIQUE(order_number,event_type,revision))`);
  await sql.query(`ALTER TABLE order_notifications ADD COLUMN IF NOT EXISTS payload jsonb,
    ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lease_until timestamptz`);
}
export function orderNotificationPayload(order) {
  const lines = (order.items || []).map(item => `<li>${html(item.name)}${item.optionLabel ? ` · ${html(item.optionLabel)}` : ''} × ${Number(item.quantity)}</li>`).join('');
  const needsDeposit = order.paymentMethod === 'bank_transfer' && order.status === 'payment_pending';
  const deposit = needsDeposit ? '<h2 style="font-size:18px">무통장입금 안내</h2><p>' + html(bankTransfer.bank) + ' <strong>' + html(bankTransfer.account) + '</strong><br>예금주 ' + html(bankTransfer.holder) + '</p><p>받는 분 이름으로 총 주문금액을 입금해 주세요. 입금자명이 다르면 주문번호와 입금자명을 고객센터에 알려주세요. 입금 확인 후 배송을 준비합니다.</p>' : '';
  const orderUrl = order.isGuest ? 'https://himawari.co.kr/guest-order.html?order=' + encodeURIComponent(order.orderNumber) : 'https://himawari.co.kr/account.html#orders';
  const tracking = order.delivery?.trackingNumber ? `<p>운송장: ${html(order.delivery.trackingNumber)} · <a href="https://www.ilogen.com/web/personal/tkSearch?t=2">로젠택배 배송조회</a></p>` : '';
  return {
    from: process.env.ORDER_FROM_EMAIL || process.env.RESTOCK_FROM_EMAIL,
    to: [order.recipient.email], ...(process.env.ORDER_REPLY_TO ? { reply_to: process.env.ORDER_REPLY_TO } : {}),
    text: ['주문 상태: ' + order.statusLabel, '주문번호: ' + order.orderNumber, ...(order.items || []).map(item => item.name + (item.optionLabel ? ' · ' + item.optionLabel : '') + ' × ' + Number(item.quantity)), '총 주문금액: ' + Number(order.total || 0).toLocaleString('ko-KR') + '원', ...(needsDeposit ? ['무통장입금: ' + bankTransfer.bank + ' ' + bankTransfer.account, '예금주: ' + bankTransfer.holder, '받는 분 이름으로 입금해 주세요. 입금 확인 후 배송을 준비합니다.'] : []), '주문 확인: ' + orderUrl, '고객센터: golf4484@naver.com / 010-8447-6271'].join('\n'),
    subject: `[Himawari] ${order.orderNumber} · ${order.statusLabel}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#223229;max-width:620px"><h1 style="font-size:24px">주문 상태: ${html(order.statusLabel)}</h1><p>주문번호 <strong>${html(order.orderNumber)}</strong></p><ul>${lines}</ul><p>총 주문금액 <strong>${Number(order.total || 0).toLocaleString('ko-KR')}원</strong></p>${deposit}${tracking}<p><a href="${html(orderUrl)}">주문 확인하기</a></p><hr><p style="font-size:12px">히마와리 코리아 · golf4484@naver.com · 010-8447-6271</p></div>`,
  };
}
async function deliver(row) {
  const sql = database();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`order/${row.id}` },
      body: JSON.stringify(row.payload),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    await sql.query("UPDATE order_notifications SET status='sent',sent_at=now(),payload=NULL,error_message=NULL,lease_until=NULL WHERE id=$1", [row.id]);
    return { sent:true,configured:true };
  } catch(error) {
    await sql.query("UPDATE order_notifications SET status='failed',error_message=$2,lease_until=now()+interval '5 minutes' WHERE id=$1", [row.id,String(error.message).slice(0,500)]).catch(()=>{});
    console.error('order_notification_failed', { notificationId:row.id });
    return { sent:false,configured:true };
  }
}
export async function sendOrderNotification(order, eventType='status') {
  if (!configured() || !order?.orderNumber || !order?.recipient?.email) return { sent:false,configured:false };
  try {
    await ensureNotificationSchema();
    const rows=await database().query(`INSERT INTO order_notifications(id,order_number,event_type,revision,payload,attempts,lease_until)
      VALUES($1,$2,$3,$4,$5::jsonb,1,now()+interval '2 minutes') ON CONFLICT(order_number,event_type,revision) DO NOTHING RETURNING id,payload`,
      [randomUUID(),order.orderNumber,eventType,Number(order.revision||1),JSON.stringify(orderNotificationPayload(order))]);
    return rows[0] ? await deliver(rows[0]) : { sent:false,duplicate:true,configured:true };
  } catch { console.error('order_notification_enqueue_failed'); return { sent:false,configured:true }; }
}
export async function retryOrderNotifications() {
  if(!configured()) throw Object.assign(new Error('주문 메일 발송 설정이 필요합니다.'),{status:503});
  await ensureNotificationSchema();
  const sql=database();
  // Resend retains idempotency keys for 24h. A 23h cutoff leaves room for delivery and clock skew.
  await sql.query(`UPDATE order_notifications n SET status='manual_review',payload=NULL WHERE n.payload IS NOT NULL
    AND (n.created_at<=now()-interval '23 hours' OR n.attempts>=5 OR NOT EXISTS(SELECT 1 FROM orders o WHERE o.order_number=n.order_number AND o.revision=n.revision))
    AND (n.lease_until IS NULL OR n.lease_until<now()) AND n.status IN ('failed','pending')`);
  const rows=await sql.query(CLAIM_NOTIFICATION_RETRIES);
  const results=[];for(const row of rows)results.push(await deliver(row));
  return { processed:rows.length,sent:results.filter(r=>r.sent).length };
}
