import { createHmac, timingSafeEqual } from 'node:crypto';
import { createOrder } from './orders.js';
import { paymentStore } from './kakaopay-store.js';
import { callKakaopay, kakaopayConfig, KAKAOPAY_ORIGIN, safePaymentRedirect, verifyPayment, UNPAID_TERMINAL } from './kakaopay-client.js';
import { sendOrderNotification } from './order-notifications.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = message => Object.assign(new Error(message), {status:409});

export function paymentState(id, secret = process.env.MEMBER_SESSION_SECRET) {
  if (!uuid.test(id) || (secret || '').length < 32) throw Object.assign(new Error('결제 요청을 확인할 수 없습니다.'),{status:400});
  return createHmac('sha256',secret).update(`himawari:kakaopay:v1:${id}`).digest('hex');
}

export function validatePaymentState(id, state, secret = process.env.MEMBER_SESSION_SECRET) {
  if (!uuid.test(id || '') || !/^[a-f0-9]{64}$/.test(state || '')) throw Object.assign(new Error('유효한 결제 요청이 아닙니다.'),{status:403});
  if (!timingSafeEqual(Buffer.from(paymentState(id,secret)),Buffer.from(state))) throw Object.assign(new Error('유효한 결제 요청이 아닙니다.'),{status:403});
}

export function paymentCallbacks(id, state) {
  return Object.fromEntries(['approval','cancel','fail'].map(outcome => [`${outcome}_url`,`${KAKAOPAY_ORIGIN}/payment-return.html?order=${id}&state=${state}&outcome=${outcome}`]));
}

export function createPaymentService({store=paymentStore,provider=callKakaopay,create=createOrder,notify=sendOrderNotification,config=kakaopayConfig,sign=paymentState,validate=validatePaymentState}={}) {
  async function sessionFor(id,state) {
    validate(id,state);
    const session = await store.get(id);
    if (!session) throw Object.assign(new Error('결제 요청을 찾을 수 없습니다.'),{status:404});
    return session;
  }
  function receipt(session) {
    return {phase:session.phase,orderNumber:session.order_number,total:Number(session.total),paid:session.phase==='paid',refunded:session.phase==='refunded'};
  }
  async function lookup(session) {
    return verifyPayment(await provider('order',{tid:session.tid}),session);
  }
  async function settle(session) {
    const changed = await store.paid(session.order_id);
    if (changed) await notify(await store.order(session.order_id),'kakaopay-paid');
    return receipt(await store.get(session.order_id));
  }
  return {
    async ready(member,input) {
      const cfg = config();
      if (!cfg.enabled) throw Object.assign(new Error('카카오페이 결제 연결을 준비하고 있습니다.'),{status:503});
      const {order} = await create(member,{...input,paymentMethod:'kakaopay'},{paymentMethod:'kakaopay'});
      if (order.status !== 'payment_pending') throw conflict('이미 접수되거나 종료된 주문입니다. 주문 내역을 확인해 주세요.');
      const id = input.requestId;
      const state = sign(id);
      const partner = createHmac('sha256',process.env.MEMBER_SESSION_SECRET || state).update(`pay-user:${id}`).digest('hex');
      await store.insert(id,cfg.cid,partner);
      let session = await store.get(id);
      if (new Date(session.expires_at).getTime() <= Date.now()) throw conflict('결제 시간이 만료되었습니다. 주문 내역에서 취소한 뒤 새 주문서를 작성해 주세요.');
      if (session.phase === 'ready') return {...receipt(session),state,orderId:id,pc:safePaymentRedirect(session.redirect_pc),mobile:safePaymentRedirect(session.redirect_mobile)};
      if (!await store.acquire(id,'new',['new'])) throw conflict('이 주문의 결제를 처리하고 있습니다. 잠시 후 같은 주문에서 다시 확인해 주세요.');
      try {
        const quantity = order.items.reduce((sum,item)=>sum+item.quantity,0);
        const itemName = `${order.items[0].name}${order.items.length>1 ? ` 외 ${order.items.length-1}종` : ''}`.slice(0,100);
        const result = await provider('ready',{
          partner_order_id:order.orderNumber,partner_user_id:session.partner_user_id,item_name:itemName,quantity,
          total_amount:order.total,tax_free_amount:0,...paymentCallbacks(id,state),
        });
        if (!/^T[A-Za-z0-9]{19}$/.test(result.tid || '')) throw conflict('결제 고유번호를 확인하지 못했습니다.');
        const redirects = {tid:result.tid,pc:safePaymentRedirect(result.next_redirect_pc_url),mobile:safePaymentRedirect(result.next_redirect_mobile_url)};
        await store.ready(id,redirects);
        session = await store.get(id);
        return {...receipt(session),state,orderId:id,pc:redirects.pc,mobile:redirects.mobile};
      } finally { await store.release(id); }
    },
    async finish(id,state,pgToken) {
      let session = await sessionFor(id,state);
      if (['paid','refunded','closed'].includes(session.phase)) return receipt(session);
      if (!session.tid) throw conflict('결제 준비가 완료되지 않았습니다. 주문서를 다시 확인해 주세요.');
      if (!await store.acquire(id,'approving',['ready','approving'])) throw conflict('결제 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.');
      try {
        // Query first: recover a successful charge after timeout without charging again.
        const known = await lookup(session);
        if (known.status === 'SUCCESS_PAYMENT') return await settle(session);
        if (known.status === 'CANCEL_PAYMENT' && Number(known.canceled_amount?.total)===Number(session.total) && Number(known.cancel_available_amount?.total)===0) {
          await store.cancelPendingPayment(id); return receipt(await store.get(id));
        }
        if (UNPAID_TERMINAL.has(known.status)) { await store.close(id); return receipt(await store.get(id)); }
        if (session.approval_started) throw conflict('이미 승인 요청한 주문입니다. 새 결제 없이 결과를 다시 확인하거나 고객센터에 문의해 주세요.');
        if (new Date(session.expires_at).getTime() <= Date.now()) throw conflict('결제 시간이 만료되었습니다. 고객센터에 주문번호를 알려 주세요.');
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(pgToken || '')) throw conflict('결제 인증을 완료한 뒤 다시 확인해 주세요.');
        await store.reserve(session);
        session = await store.get(id);
        await store.markApproval(id);
        let result;
        try {
          result = await provider('approve',{tid:session.tid,partner_order_id:session.order_number,partner_user_id:session.partner_user_id,pg_token:pgToken,total_amount:Number(session.total)});
        } catch (error) {
          const after = await lookup(session).catch(()=>null);
          if (after?.status==='SUCCESS_PAYMENT') return await settle(session);
          if (after && UNPAID_TERMINAL.has(after.status)) { await store.close(id); return receipt(await store.get(id)); }
          throw error;
        }
        verifyPayment(result,session);
        if (!result.approved_at || !result.aid) throw conflict('결제 승인 결과를 다시 확인해야 합니다.');
        return await settle(session);
      } finally { await store.release(id); }
    },
    async status(id,state) { return receipt(await sessionFor(id,state)); },
    async abandon(id,state) {
      const session = await sessionFor(id,state);
      if (['paid','refunded','closed'].includes(session.phase)) return receipt(session);
      if (!await store.acquire(id,'approving',['ready','approving','new'])) throw conflict('결제 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.');
      try {
        if (!session.tid) { await store.close(id); return receipt(await store.get(id)); }
        const known = await lookup(session);
        if (known.status==='SUCCESS_PAYMENT') return await settle(session);
        // A browser cancellation flag alone never proves that payment did not happen.
        if (UNPAID_TERMINAL.has(known.status) || (!session.approval_started && ['READY','SEND_TMS','OPEN_PAYMENT','SELECT_METHOD','AUTH_PASSWORD','ARS_WAITING'].includes(known.status))) {
          await store.close(id); return receipt(await store.get(id));
        }
        throw conflict('결제 결과를 확정하지 못했습니다. 고객센터에 주문번호를 알려 주세요.');
      } finally { await store.release(id); }
    },
    async adminChange(current,target) {
      let session = await store.get(current.id);
      if (!session) throw conflict('카카오페이 결제 기록을 확인할 수 없습니다.');
      if (session.lease_until && new Date(session.lease_until)>new Date()) throw conflict('카카오페이 결제 처리 중입니다. 잠시 후 다시 확인해 주세요.');
      if (!['cancelled','refunded'].includes(target)) {
        if (session.phase!=='paid' || target==='payment_pending') throw conflict('결제 승인 확인 전에는 배송 상태를 변경할 수 없습니다.');
        return;
      }
      if (['refunded','closed'].includes(session.phase)) return;
      if (!await store.acquire(current.id,'cancelling',['new','ready','approving','paid','cancelling'])) throw conflict('결제 처리 중입니다. 잠시 후 다시 시도해 주세요.');
      try {
        if (!session.tid) {
          await store.void(current.id); return;
        }
        let result = await lookup(session);
        if (result.status==='SUCCESS_PAYMENT') {
          result = verifyPayment(await provider('cancel',{tid:session.tid,cancel_amount:Number(session.total),cancel_tax_free_amount:0,cancel_available_amount:Number(session.total)}),session);
        }
        if (result.status==='CANCEL_PAYMENT' && Number(result.canceled_amount?.total)===Number(session.total) && Number(result.cancel_available_amount?.total)===0) {
          await store.refunded(current.id); return;
        }
        if (UNPAID_TERMINAL.has(result.status) || (!session.approval_started && ['READY','SEND_TMS','OPEN_PAYMENT','SELECT_METHOD','AUTH_PASSWORD','ARS_WAITING'].includes(result.status))) {
          await store.void(current.id); return;
        }
        throw conflict('카카오페이의 전체 취소 결과를 확인하지 못했습니다. 취소·환불 완료로 기록하지 않았습니다.');
      } finally { await store.release(current.id); }
    },
  };
}

export const kakaopay = createPaymentService();
export async function prepareKakaopayAdminChange(current,target) { return kakaopay.adminChange(current,target); }
