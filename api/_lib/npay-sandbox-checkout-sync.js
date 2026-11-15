import {database} from './database.js';
import {ensureNpayReservationSchema} from './inventory-reservation-store.js';
import {readNpayOrderMetadata} from './npay-order-feed.js';
import {reconcileNpayOrderMetadata} from './npay-settlement.js';

const failure=status=>Object.assign(new Error('시험 주문의 조회 범위를 확인해 주세요.'),{status});
async function readReservations(checkoutId){
  await ensureNpayReservationSchema();
  return database().query(`SELECT r.id,c.environment FROM npay_inventory_reservations r
    JOIN npay_checkouts c ON c.id=r.checkout_id WHERE c.id=$1`,[checkoutId]);
}

// Private preview verification only. Query the exact buyer-visible test IDs;
// never scan an older interval or move the ordinary polling watermark.
export async function syncNpaySandboxCheckout({checkoutId,productOrderIds,request}={},
  {loadReservations=readReservations,reconcile=reconcileNpayOrderMetadata}={}){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId||'')
    ||!Array.isArray(productOrderIds)||!productOrderIds.length||productOrderIds.length>50
    ||productOrderIds.some(id=>typeof id!=='string'||!/^\d{10,30}$/.test(id))
    ||new Set(productOrderIds).size!==productOrderIds.length||typeof request!=='function')throw failure(400);
  const reservations=await loadReservations(checkoutId);
  if(!reservations.length)throw failure(404);
  if(reservations.some(row=>row.environment!=='sandbox'))throw failure(403);
  const aliases=new Set(reservations.map(row=>row.id));
  const details=await readNpayOrderMetadata({productOrderIds,request});
  if(details.missingProductOrderIds.length||details.orders.some(order=>!aliases.has(order.productId))
    ||new Set(details.orders.map(order=>order.productId)).size!==details.orders.length)throw failure(409);
  const settled=await reconcile(details.orders,{environment:'sandbox'});
  return{bound:settled.bound,updated:settled.updated,ignored:settled.ignored,incidents:settled.incidents.length,
    missing:0,changeCount:details.orders.length,cursorAdvanced:false,collectionFinal:false,scope:'sandbox-checkout'};
}
