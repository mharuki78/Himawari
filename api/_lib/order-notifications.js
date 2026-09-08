import { randomUUID } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';

function configured() { return Boolean(databaseIsConfigured() && process.env.RESEND_API_KEY && (process.env.ORDER_FROM_EMAIL || process.env.RESTOCK_FROM_EMAIL)); }
function html(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }

export async function sendOrderNotification(order, eventType = 'status') {
  if (!configured() || !order?.orderNumber || !order?.recipient?.email) return { sent: false, configured: false };
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS order_notifications (
    id text PRIMARY KEY, order_number text NOT NULL, event_type text NOT NULL, revision integer NOT NULL,
    status text NOT NULL DEFAULT 'pending', error_message text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
    UNIQUE(order_number,event_type,revision)
  )`;
  const claimed = await sql.query(
    `INSERT INTO order_notifications (id,order_number,event_type,revision) VALUES ($1,$2,$3,$4)
     ON CONFLICT (order_number,event_type,revision) DO NOTHING RETURNING id`,
    [randomUUID(), order.orderNumber, eventType, Number(order.revision || 1)],
  );
  if (!claimed[0]) return { sent: false, duplicate: true, configured: true };
  const lines = (order.items || []).map((item) => `<li>${html(item.name)}${item.optionLabel ? ` · ${html(item.optionLabel)}` : ''} × ${Number(item.quantity)}</li>`).join('');
  const tracking = order.delivery?.trackingNumber
    ? `<p>운송장: ${html(order.delivery.trackingNumber)} · <a href="https://www.ilogen.com/web/personal/tkSearch?t=2">로젠택배 배송조회</a></p>` : '';
  const subject = `[Himawari] ${html(order.orderNumber)} · ${html(order.statusLabel)}`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8_000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ORDER_FROM_EMAIL || process.env.RESTOCK_FROM_EMAIL,
        to: [order.recipient.email],
        ...(process.env.ORDER_REPLY_TO ? { reply_to: process.env.ORDER_REPLY_TO } : {}),
        subject,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#223229;max-width:620px"><h1 style="font-size:24px">주문 상태: ${html(order.statusLabel)}</h1><p>주문번호 <strong>${html(order.orderNumber)}</strong></p><ul>${lines}</ul><p>총 주문금액 <strong>${Number(order.total || 0).toLocaleString('ko-KR')}원</strong></p>${tracking}<p><a href="https://allaboutbag.com/${order.isGuest ? 'guest-order.html' : 'account.html#orders'}">주문 확인하기</a></p><hr><p style="font-size:12px">히마와리 코리아 · golf4484@naver.com · 010-5337-3981</p></div>`,
      }),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    await sql.query('UPDATE order_notifications SET status=$1,sent_at=now() WHERE id=$2', ['sent', claimed[0].id]);
    return { sent: true, configured: true };
  } catch (error) {
    await sql.query('UPDATE order_notifications SET status=$1,error_message=$2 WHERE id=$3', ['failed', String(error.message || 'unknown').slice(0, 500), claimed[0].id]).catch(() => {});
    console.error('order_notification_failed', { orderNumber: order.orderNumber, eventType, message: error.message || 'unknown' });
    return { sent: false, configured: true };
  }
}
