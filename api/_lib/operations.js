import { database } from './database.js';
import { readProductCatalog } from './products.js';
import { applyInventoryReservations } from './inventory.js';
import { readAdminSession } from './auth.js';

async function optionalQuery(statement, params = []) {
  try { return await database().query(statement, params); }
  catch (error) { if (error.code === '42P01') return []; throw error; }
}

export async function readOperations(request) {
  const [orders, pending, notifications, catalog, audit] = await Promise.all([
    optionalQuery('SELECT status,count(*)::integer AS count FROM orders GROUP BY status'),
    optionalQuery(`SELECT order_number,created_at,total FROM orders WHERE status='payment_pending' ORDER BY created_at ASC LIMIT 20`),
    optionalQuery(`SELECT status,count(*)::integer AS count FROM order_notifications GROUP BY status`),
    readProductCatalog(),
    readAdminSession(request)?.role === 'owner' ? optionalQuery('SELECT actor,role,action,status,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 30') : Promise.resolve([]),
  ]);
  const products = await applyInventoryReservations(catalog.catalog.products);
  const counts = Object.fromEntries(orders.map(row => [row.status, Number(row.count)]));
  return {
    checkedAt: new Date().toISOString(), canRetry: readAdminSession(request)?.role === 'owner', counts, pending,
    notifications: Object.fromEntries(notifications.map(row => [row.status, Number(row.count)])), audit,
    inventory: {
      low: products.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 5).map(p => ({ id:p.id,name:p.name,stock:p.stock })).slice(0,30),
      unknown: products.filter(p => p.stock === null || p.stock === undefined).length,
      incompleteSpecs: products.filter(p => !p.specs?.dimensions || !p.specs?.material || !p.specs?.weight).length,
    },
    readiness: {
      payment: 'PG 계약·승인 연동 준비 중 — 주문금액은 결제 매출이 아닙니다.',
      canonical: process.env.PUBLIC_SITE_URL === 'https://himawari.co.kr' ? '대표 주소 설정 완료 (로그인 실제 확인 필요)' : '로그인 제공자 콜백 등록 및 PUBLIC_SITE_URL 전환 필요',
      mail: Boolean(process.env.RESEND_API_KEY && (process.env.ORDER_FROM_EMAIL || process.env.RESTOCK_FROM_EMAIL)),
      catalogPersisted: catalog.persisted,
      inventory: '자사몰 할당 재고입니다. 스마트스토어 자동 동기화는 연결되지 않았습니다.',
    },
  };
}
