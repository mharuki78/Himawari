import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,scryptSync} from 'node:crypto';
import {normalizeSpecs,normalizeRelatedIds} from '../assets/product-specs.js';
import {seedCatalog,publicProduct,updateProductRecord} from '../api/_lib/products.js';
import {adminCanAccess,adminForPassword,createSessionCookie,readAdminSession} from '../api/_lib/auth.js';
import {validateSupportAttachment} from '../api/_lib/support.js';
import {createSupportReceipt,readSupportReceipt} from '../api/_lib/support-receipt.js';
import {encryptBackup,decryptBackup,assertSeparateTarget} from '../scripts/lib/backup.js';
import {orderNotificationPayload} from '../api/_lib/order-notifications.js';
const hash=password=>{const salt=randomBytes(16);return `scrypt$${salt.toString('base64url')}$${scryptSync(password,salt,64).toString('base64url')}`;};
const request=(path,method='GET',cookie='')=>new Request('https://himawari.co.kr'+path,{method,headers:{cookie}});

test('상품 실측은 미등록 값 없이 만들어내지 않고 기존 수정에서도 보존한다',()=>{
 const initial={...seedCatalog().products[0],specs:normalizeSpecs({dimensions:' 30 × 40 × 12 ',care:'라벨 확인'}),relatedProductIds:['accessory-1']};
 const changed=updateProductRecord(initial,{...initial,name:'수정 이름'},[]);
 assert.equal(publicProduct(changed).specs.dimensions,'30 × 40 × 12');assert.equal(normalizeSpecs().weight,'');
 assert.deepEqual(normalizeRelatedIds(['ok','ok','../unsafe','bad url',3]),['ok']);
});
test('관리자 역할은 같은 비밀번호 로그인으로 식별하고 업무별 쓰기를 제한한다',()=>{
 process.env.ADMIN_PASSWORD_HASH=hash('owner-password');process.env.ADMIN_SESSION_SECRET=randomBytes(32).toString('hex');process.env.ADMIN_STAFF_ACCOUNTS=JSON.stringify([{id:'shipping',role:'fulfillment',passwordHash:hash('shipping-password')}]);
 assert.equal(adminForPassword('owner-password').role,'owner');assert.equal(adminForPassword('shipping-password').role,'fulfillment');assert.equal(adminForPassword('wrong'),null);
 assert.equal(adminCanAccess({role:'fulfillment'},request('/api/admin/orders','PATCH')),true);
 assert.equal(adminCanAccess({role:'fulfillment'},request('/api/admin/products','PATCH')),false);
 assert.equal(adminCanAccess({role:'support'},request('/api/admin/products?route=reviews','PATCH')),true);
 assert.equal(adminCanAccess({role:'catalog'},request('/api/admin/products?route=reviews','PATCH')),false);
 assert.equal(adminCanAccess({role:'viewer'},request('/api/admin/inquiries','DELETE')),false);
 assert.equal(adminCanAccess({role:'catalog'},request('/api/admin/orders?route=ops-retry-notifications','POST')),false);
});
test('담당자 삭제와 서명 변조는 기존 관리자 세션을 무효화한다',()=>{
 process.env.ADMIN_PASSWORD_HASH=hash('owner');process.env.ADMIN_SESSION_SECRET=randomBytes(32).toString('hex');process.env.ADMIN_STAFF_ACCOUNTS=JSON.stringify([{id:'staff',role:'support'}]);
 const cookie=createSessionCookie(request('/'),{id:'staff',role:'support'}).split(';')[0];
 assert.equal(readAdminSession(request('/', 'GET',cookie)).role,'support');assert.ok(!readAdminSession(request('/','GET',cookie+'x')));
 process.env.ADMIN_STAFF_ACCOUNTS='[]';assert.ok(!readAdminSession(request('/','GET',cookie)));
});
test('문의 첨부는 HTML·위장 MIME·과대 파일을 거부한다',()=>{
 assert.equal(validateSupportAttachment(null),null);
 for(const attachment of [{type:'image/svg+xml',data:Buffer.from('<svg/>').toString('base64')},{type:'image/png',data:Buffer.from('<html>bad</html>').toString('base64')},{type:'image/jpeg',data:'A'.repeat(2800001)}])assert.throws(()=>validateSupportAttachment(attachment));
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);assert.equal(validateSupportAttachment({type:'image/png',data:png.toString('base64')}).type,'image/png');
});
test('비공개 문의 확인 링크는 서명·만료·경로를 검증한다',()=>{
 process.env.SUPPORT_RECEIPT_SECRET=randomBytes(32).toString('hex');const id='8888888888888-11111111-1111-4111-8111-111111111111';const token=createSupportReceipt(id,1000);
 assert.equal(readSupportReceipt(token,1001),id);assert.equal(readSupportReceipt(token+'a',1001),null);assert.equal(readSupportReceipt(token,31*86400000),null);assert.equal(createSupportReceipt('../other',1000),'');
});
test('백업은 암호화 왕복과 변조 검증, 운영 DB 복구 차단을 수행한다',()=>{
 const key=randomBytes(32).toString('base64'),source=Buffer.from('private order data');const bytes=encryptBackup(source,key);
 assert.deepEqual(decryptBackup(bytes,key),source);assert.equal(bytes.includes(source),false);assert.throws(()=>decryptBackup(bytes,randomBytes(32).toString('base64')));
 bytes[bytes.length-1]^=1;assert.throws(()=>decryptBackup(bytes,key));
 assert.throws(()=>assertSeparateTarget('postgres://u:p@prod.neon.tech/db','postgres://u:p@prod-pooler.neon.tech/other'));
 assert.equal(assertSeparateTarget('postgres://u:p@prod.neon.tech/db','postgres://u:p@isolated.neon.tech/db'),true);
});
test('주문 안내는 HTML을 이스케이프하고 비회원 대표 주소로 연결한다',()=>{
 const payload=orderNotificationPayload({orderNumber:'HMW-test',recipient:{email:'customer@example.test'},statusLabel:'결제 대기',items:[{name:'<img src=x>',quantity:1}],isGuest:true,total:100});
 assert.ok(payload.html.includes('&lt;img src=x&gt;'));assert.ok(payload.html.includes('https://himawari.co.kr/guest-order.html'));assert.ok(!payload.html.includes('결제 완료'));
});
