import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {couponClaimStatement} from '../api/_lib/coupon-claims.js';
import {CONFIRM_ORDER_SQL,CANCEL_ORDER_SQL} from '../api/_lib/order-transactions.js';

test('PostgreSQL: 주문 생성 실패·중복 제출은 쿠폰 상태를 되돌리고 다른 주문의 재사용은 거부한다',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE coupon_claims(id text PRIMARY KEY,coupon_id text,token_hash text,used_at timestamptz,order_id text,expires_at timestamptz);CREATE TABLE orders(id text PRIMARY KEY);`);
 const token='coupon-token-for-integration-test-1234';await db.query("INSERT INTO coupon_claims VALUES('claim','discount',$1,NULL,NULL,now()+interval '1 day')",[createHash('sha256').update(token).digest('hex')]);
 const create=async id=>db.transaction(async tx=>{const claim=couponClaimStatement('discount',token,id);await tx.query(claim.text,claim.values);await tx.query('INSERT INTO orders VALUES($1)',[id]);});
 await assert.rejects(db.transaction(async tx=>{const claim=couponClaimStatement('discount',token,'failed');await tx.query(claim.text,claim.values);throw Error('order write failed');}));
 assert.equal((await db.query('SELECT used_at FROM coupon_claims')).rows[0].used_at,null);
 await create('first');await assert.rejects(create('first'));assert.equal((await db.query('SELECT order_id FROM coupon_claims')).rows[0].order_id,'first');
 await assert.rejects(create('second'),error=>error.code==='22012');assert.equal((await db.query('SELECT count(*)::integer count FROM orders')).rows[0].count,1);
 }finally{await db.close();}
});

test('PostgreSQL: 재고 부족 확인은 주문·예약을 남기지 않고 취소는 예약과 쿠폰을 함께 복원한다',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE orders(id text PRIMARY KEY,order_number text,status text,tracking_number text,revision integer,updated_at timestamptz);
 CREATE TABLE order_items(id text PRIMARY KEY,order_id text,product_id text,option_id text,quantity integer);
 CREATE TABLE inventory_reservations(order_item_id text PRIMARY KEY,order_id text,product_id text,option_id text,quantity integer,active boolean,updated_at timestamptz);
 CREATE TABLE order_events(id text PRIMARY KEY,order_id text,actor text,from_status text,to_status text,note text);
 CREATE TABLE coupon_claims(id text PRIMARY KEY,order_id text,used_at timestamptz);
 INSERT INTO orders VALUES('one','ONE','payment_pending',NULL,1,now()),('two','TWO','payment_pending',NULL,1,now());
 INSERT INTO order_items VALUES('item1','one','bag','',1),('item2','two','bag','',1);
 INSERT INTO coupon_claims VALUES('coupon','one',now());`);
 const confirm=(id,number,event)=>db.transaction(async tx=>{await tx.query("SELECT pg_advisory_xact_lock(hashtext('himawari_inventory'))");return tx.query(CONFIRM_ORDER_SQL,['confirmed',null,number,1,'payment_pending',event,'confirm',JSON.stringify([{productId:'bag',optionId:'',baseStock:1}]),id]);});
 assert.equal((await confirm('one','ONE','e1')).rows.length,1);assert.equal((await confirm('two','TWO','e2')).rows.length,0);
 assert.equal((await db.query("SELECT status FROM orders WHERE id='two'")).rows[0].status,'payment_pending');
 await db.query(CANCEL_ORDER_SQL,['cancelled',null,'ONE',2,'confirmed','e3','cancel']);
 assert.equal((await db.query("SELECT active FROM inventory_reservations WHERE order_id='one'")).rows[0].active,false);
 assert.equal((await db.query('SELECT order_id FROM coupon_claims')).rows[0].order_id,null);
 assert.equal((await confirm('two','TWO','e4')).rows.length,1);
 }finally{await db.close();}
});

test('PostgreSQL: 메일 재시도는 원본과 잠금을 유지하고 만료·이전 상태·최대 횟수를 제외한다',async()=>{
 const {CLAIM_NOTIFICATION_RETRIES}=await import('../api/_lib/notification-queue.js');const db=new PGlite();try{
 await db.exec(`CREATE TABLE orders(order_number text,revision integer);INSERT INTO orders VALUES('ONE',2);
 CREATE TABLE order_notifications(id text PRIMARY KEY,order_number text,revision integer,status text,payload jsonb,attempts integer,created_at timestamptz,lease_until timestamptz);
 INSERT INTO order_notifications VALUES
 ('eligible','ONE',2,'failed','{"to":["test@example.test"],"subject":"Original"}',1,now()-interval '1 hour',NULL),
 ('old-state','ONE',1,'failed','{}',1,now()-interval '1 hour',NULL),
 ('expired','ONE',2,'failed','{}',1,now()-interval '24 hours',NULL),
 ('leased','ONE',2,'pending','{}',1,now()-interval '1 hour',now()+interval '1 minute'),
 ('maximum','ONE',2,'failed','{}',5,now()-interval '1 hour',NULL),
 ('legacy','ONE',2,'failed',NULL,1,now()-interval '1 hour',NULL);`);
 const first=await db.query(CLAIM_NOTIFICATION_RETRIES);assert.deepEqual(first.rows.map(row=>row.id),['eligible']);assert.equal(first.rows[0].payload.subject,'Original');
 assert.equal((await db.query(CLAIM_NOTIFICATION_RETRIES)).rows.length,0);
 assert.equal((await db.query("SELECT attempts FROM order_notifications WHERE id='eligible'")).rows[0].attempts,2);
 }finally{await db.close();}
});
