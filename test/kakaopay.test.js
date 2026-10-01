import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { kakaopayConfig, callKakaopay, safePaymentRedirect, verifyPayment, KAKAOPAY_CID } from '../api/_lib/kakaopay-client.js';
import { createPaymentService, paymentState, validatePaymentState, paymentCallbacks } from '../api/_lib/kakaopay.js';
import { PAYMENT_SCHEMA_SQL, ACQUIRE_PAYMENT_SQL, SETTLE_PAYMENT_SQL, CLOSE_PAYMENT_SQL } from '../api/_lib/kakaopay-store.js';
import { fetch as ordersHandler } from '../api/orders.js';

const id='9b3571c6-66cb-4f30-85a7-79ca7486054e';
const key='test-server-payment-state-secret-longer-than-32';
const state=paymentState(id,key);
const sign=value=>paymentState(value,key);
const validate=(value,token)=>validatePaymentState(value,token,key);

function fixture({status='AUTH_PASSWORD',reserveFails=false,approveThrows=false}={}) {
  let payment={order_id:id,cid:KAKAOPAY_CID,partner_user_id:'opaque-user',order_number:'HMW-TEST',total:48000,phase:'ready',tid:'T1234567890123456789',order_status:'payment_pending',revision:1,expires_at:new Date(Date.now()+1800000).toISOString(),approval_started:false};
  let providerStatus=status;
  const calls=[];
  const response=extra=>({tid:payment.tid,cid:payment.cid,partner_order_id:payment.order_number,partner_user_id:payment.partner_user_id,amount:{total:payment.total},...extra});
  const store={
    get:async()=>({...payment}),insert:async()=>{},order:async()=>({orderNumber:payment.order_number}),
    acquire:async(_,phase,from)=>{if(!from.includes(payment.phase)||payment.lease_until) return null;payment.phase=phase;payment.lease_until=new Date(Date.now()+60000);return {...payment};},
    release:async()=>{payment.lease_until=null;},markApproval:async()=>{payment.approval_started=true;},
    reserve:async()=>{calls.push('reserve');if(reserveFails)throw Object.assign(Error('stock'),{status:409});payment.revision++;},
    paid:async()=>{if(payment.phase==='paid')return false;payment.phase='paid';payment.order_status='confirmed';calls.push('paid');return true;},
    close:async()=>{payment.phase='closed';calls.push('release-stock-and-coupon');},
    refunded:async()=>{payment.phase='refunded';calls.push('refunded');},void:async()=>{payment.phase='closed';calls.push('void');},
    cancelPendingPayment:async()=>{payment.phase='refunded';payment.order_status='cancelled';calls.push('refund-and-release');},
    ready:async(_,value)=>{payment.phase='ready';payment.tid=value.tid;payment.redirect_pc=value.pc;payment.redirect_mobile=value.mobile;},
  };
  const provider=async(action,body)=>{
    calls.push(action);
    if(action==='order')return response({status:providerStatus,canceled_amount:{total:providerStatus==='CANCEL_PAYMENT'?48000:0},cancel_available_amount:{total:providerStatus==='CANCEL_PAYMENT'?0:48000}});
    if(action==='approve') {
      assert.equal(body.total_amount,48000);assert.equal(body.pg_token,'token');providerStatus='SUCCESS_PAYMENT';
      if(approveThrows)throw Object.assign(Error('timeout'),{uncertain:true});
      return response({aid:'approval',approved_at:'2026-10-01T12:00:00'});
    }
    if(action==='cancel') { assert.equal(body.cancel_amount,48000); providerStatus='CANCEL_PAYMENT'; return response({status:providerStatus,canceled_amount:{total:48000},cancel_available_amount:{total:0}}); }
    if(action==='ready') { assert.equal(body.total_amount,48000);assert.equal(body.tax_free_amount,0);assert.ok(!body.partner_user_id.includes('@'));return {tid:payment.tid,next_redirect_pc_url:'https://online-payment.kakaopay.com/info',next_redirect_mobile_url:'https://online-payment.kakaopay.com/mobile'}; }
  };
  const service=createPaymentService({store,provider,sign,validate,config:()=>({enabled:true,cid:KAKAOPAY_CID}),notify:async()=>{calls.push('notify');},create:async()=>({order:{orderNumber:'HMW-TEST',status:'payment_pending',total:48000,items:[{name:'Himawari 1884',quantity:1}]}})});
  return {service,payment,calls,store,setStatus:value=>{providerStatus=value;}};
}

test('운영 키·CID·별도 활성화가 필요하고 OAuth/개발키는 결제를 활성화하지 않는다',()=>{
  const env={KAKAOPAY_ENABLED:'true',KAKAOPAY_CID:KAKAOPAY_CID,KAKAOPAY_SECRET_KEY:'PROD-secret-test-123456789',DATABASE_URL:'test',MEMBER_SESSION_SECRET:key};
  assert.equal(kakaopayConfig(env).enabled,true);
  for(const change of [{KAKAOPAY_ENABLED:'false'},{KAKAOPAY_CID:'TC0ONETIME'},{KAKAOPAY_SECRET_KEY:''},{KAKAOPAY_SECRET_KEY:'DEV-secret-test-123456789'},{MEMBER_SESSION_SECRET:''}])assert.equal(kakaopayConfig({...env,...change}).enabled,false);
});
test('인증키는 서버 헤더에만 전달하고 오류 원문·민감 정보는 공개하지 않는다',async()=>{
  let sent;
  await callKakaopay('ready',{cid:'tamper',total_amount:48000},{config:{enabled:true,cid:KAKAOPAY_CID,secret:'server-secret'},fetcher:async(url,options)=>{sent={url,...options};return new Response('{}');}});
  assert.equal(sent.headers.Authorization,'SECRET_KEY server-secret');assert.equal(JSON.parse(sent.body).cid,KAKAOPAY_CID);assert.equal(sent.redirect,'error');
  await assert.rejects(callKakaopay('approve',{}, {config:{enabled:true,cid:KAKAOPAY_CID,secret:'server-secret'},fetcher:async()=>new Response(JSON.stringify({error_code:-780,error_message:'secret pg_token private card'}),{status:400})}),error=>!error.message.includes('private')&&error.providerCode===-780);
});
test('콜백은 고정 운영 도메인이고 위조 상태·외부 리다이렉트를 거부한다',()=>{
  validate(id,state);assert.throws(()=>validate(id,'0'.repeat(64)));assert.throws(()=>validate('../x',state));
  for(const callback of Object.values(paymentCallbacks(id,state)))assert.equal(new URL(callback).origin,'https://himawari.co.kr');
  for(const url of ['javascript:alert(1)','https://kakao.com.evil.test/pay','https://user:pass@kakao.com/pay','http://kakao.com/pay'])assert.throws(()=>safePaymentRedirect(url));
});
test('승인 응답의 TID·CID·주문·사용자·금액 중 하나라도 다르면 거부한다',()=>{
  const session=fixture().payment;
  const good={tid:session.tid,cid:session.cid,partner_order_id:session.order_number,partner_user_id:session.partner_user_id,amount:{total:48000}};
  verifyPayment(good,session);
  for(const bad of [{tid:'other'},{cid:'other'},{partner_order_id:'other'},{partner_user_id:'other'},{amount:{total:1}},{amount:{total:'48000'}}])assert.throws(()=>verifyPayment({...good,...bad},session));
});
test('재고 예약 후 승인하고 콜백 재전송은 추가 승인·알림을 만들지 않는다',async()=>{
  const f=fixture();assert.equal((await f.service.finish(id,state,'token')).paid,true);
  assert.deepEqual(f.calls,['order','reserve','approve','paid','notify']);await f.service.finish(id,state,'token');assert.equal(f.calls.filter(c=>c==='approve').length,1);
});
test('승인 응답 유실은 실제 결제 조회로 복구하고 이중 결제하지 않는다',async()=>{
  const f=fixture({approveThrows:true});assert.equal((await f.service.finish(id,state,'token')).paid,true);assert.equal(f.calls.filter(c=>c==='approve').length,1);assert.equal(f.calls.filter(c=>c==='order').length,2);
});
test('재고 부족은 재시도에서도 결제 승인하지 않는다',async()=>{
  const f=fixture({reserveFails:true});for(let n=0;n<2;n++)await assert.rejects(f.service.finish(id,state,'token'));assert.ok(!f.calls.includes('approve'));assert.equal(f.payment.approval_started,false);
});
test('브라우저 취소에도 실제 결제가 있다면 승인 완료로 복구한다',async()=>{
  const f=fixture({status:'SUCCESS_PAYMENT'});assert.equal((await f.service.abandon(id,state)).paid,true);assert.ok(!f.calls.includes('release-stock-and-coupon'));
});
test('승인 기록 유실 중 실제 전액 취소가 확인되면 주문·예약까지 함께 복구한다',async()=>{
  const f=fixture({status:'CANCEL_PAYMENT'});f.payment.phase='approving';f.payment.approval_started=true;
  assert.equal((await f.service.finish(id,state,'token')).refunded,true);assert.equal(f.payment.order_status,'cancelled');assert.ok(f.calls.includes('refund-and-release'));assert.ok(!f.calls.includes('approve'));
});
test('승인 결과가 불확실하면 재고·쿠폰을 해제하지 않으며 단순 취소 플래그를 신뢰하지 않는다',async()=>{
  const f=fixture();f.payment.phase='approving';f.payment.approval_started=true;
  await assert.rejects(f.service.abandon(id,state));assert.ok(!f.calls.includes('release-stock-and-coupon'));
  await assert.rejects(f.service.finish(id,state,'token'));assert.ok(!f.calls.includes('approve'));
});
test('결제하지 않은 주문 종료와 유효시간 만료·동시 요청을 구분한다',async()=>{
  const f=fixture({status:'QUIT_PAYMENT'});assert.equal((await f.service.finish(id,state,'token')).phase,'closed');
  const expired=fixture();expired.payment.expires_at='2026-01-01';await assert.rejects(expired.service.finish(id,state,'token'));assert.ok(!expired.calls.includes('approve'));
  const busy=fixture();busy.payment.lease_until=new Date(Date.now()+60000);await assert.rejects(busy.service.finish(id,state,'token'));assert.deepEqual(busy.calls,[]);
});
test('관리자 환불은 실제 전액 취소 확인 후에만 완료하고 재시도는 조회로 복구한다',async()=>{
  const f=fixture({status:'SUCCESS_PAYMENT'});f.payment.phase='paid';f.payment.approval_started=true;
  await f.service.adminChange({id},'refunded');assert.deepEqual(f.calls,['order','cancel','refunded']);await f.service.adminChange({id},'refunded');assert.equal(f.calls.filter(c=>c==='cancel').length,1);
});
test('관리자도 카카오페이 미승인 주문을 수동 결제 완료로 바꾸지 못한다',async()=>{
  await assert.rejects(fixture().service.adminChange({id},'confirmed'));
});
test('결제 API는 같은 출처와 올바른 메서드·상태 토큰만 허용하고 설정은 키를 공개하지 않는다',async()=>{
  const config=await ordersHandler(new Request('https://himawari.co.kr/api/orders?route=kakaopay-config'));assert.deepEqual(await config.json(),{enabled:false});
  assert.equal((await ordersHandler(new Request('https://himawari.co.kr/api/orders?route=kakaopay-finish'))).status,405);
  const body={method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.test'},body:'{}'};
  assert.equal((await ordersHandler(new Request('https://himawari.co.kr/api/orders?route=kakaopay-finish',body))).status,403);
  body.headers.Origin='https://himawari.co.kr';assert.equal((await ordersHandler(new Request('https://himawari.co.kr/api/orders?route=kakaopay-finish',body))).status,403);
});
test('PostgreSQL: 결제 잠금·승인·취소는 주문·재고·쿠폰과 함께 원자적으로 반영한다',async()=>{
  const db=new PGlite();try {
    await db.exec(`CREATE TABLE orders(id text PRIMARY KEY,order_number text,status text,revision integer,updated_at timestamptz);
      CREATE TABLE order_events(id text PRIMARY KEY,order_id text,actor text,from_status text,to_status text,note text);
      CREATE TABLE coupon_claims(id text PRIMARY KEY,order_id text,used_at timestamptz);
      CREATE TABLE inventory_reservations(order_item_id text PRIMARY KEY,order_id text,active boolean,updated_at timestamptz);${PAYMENT_SCHEMA_SQL};
      INSERT INTO orders VALUES('one','ONE','payment_pending',1,now()),('two','TWO','payment_pending',1,now());
      INSERT INTO kakaopay_payments(order_id,cid,partner_user_id,phase) VALUES('one','CT07417871','opaque','ready'),('two','CT07417871','opaque','ready');
      INSERT INTO coupon_claims VALUES('coupon','two',now());INSERT INTO inventory_reservations VALUES('item','two',true,now());`);
    assert.equal((await db.query(ACQUIRE_PAYMENT_SQL,['one','approving',['ready','approving']])).rows.length,1);
    assert.equal((await db.query(ACQUIRE_PAYMENT_SQL,['one','approving',['ready','approving']])).rows.length,0);
    assert.equal((await db.query(SETTLE_PAYMENT_SQL,['one','paid-event'])).rows.length,1);assert.equal((await db.query(SETTLE_PAYMENT_SQL,['one','duplicate'])).rows.length,0);
    assert.equal((await db.query("SELECT status FROM orders WHERE id='one'")).rows[0].status,'confirmed');
    await db.query(CLOSE_PAYMENT_SQL,['two','close-event']);assert.equal((await db.query("SELECT active FROM inventory_reservations")).rows[0].active,false);assert.equal((await db.query('SELECT order_id FROM coupon_claims')).rows[0].order_id,null);
    await db.query(CLOSE_PAYMENT_SQL,['one','bad-close']);assert.equal((await db.query("SELECT phase FROM kakaopay_payments WHERE order_id='one'")).rows[0].phase,'paid');
  } finally {await db.close();}
});
