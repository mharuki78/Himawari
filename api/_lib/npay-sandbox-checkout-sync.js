import {database} from './database.js';
import {ensureNpayReservationSchema} from './inventory-reservation-store.js';
import {readNpayOrderMetadata,collectNpayChanges} from './npay-order-feed.js';
import {reconcileNpayOrderMetadata} from './npay-settlement.js';

const failure=status=>Object.assign(new Error('시험 주문의 조회 범위를 확인해 주세요.'),{status});
async function readReservations(checkoutId){
  await ensureNpayReservationSchema();
  return database().query(`SELECT r.id,c.environment FROM npay_inventory_reservations r
    JOIN npay_checkouts c ON c.id=r.checkout_id WHERE c.id=$1`,[checkoutId]);
}

// Private preview verification only. Query the exact buyer-visible test IDs;
// never scan an older interval or move the ordinary polling watermark.
export async function syncNpaySandboxCheckout({checkoutId,productOrderIds,request,inspectApi=false}={},
  {loadReservations=readReservations,reconcile=reconcileNpayOrderMetadata,clock=Date.now}={}){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId||'')
    ||!Array.isArray(productOrderIds)||!productOrderIds.length||productOrderIds.length>50
    ||productOrderIds.some(id=>typeof id!=='string'||!/^\d{10,30}$/.test(id))
    ||new Set(productOrderIds).size!==productOrderIds.length||typeof request!=='function'||typeof inspectApi!=='boolean')throw failure(400);
  const reservations=await loadReservations(checkoutId);
  if(!reservations.length)throw failure(404);
  if(reservations.some(row=>row.environment!=='sandbox'))throw failure(403);
  const aliases=new Set(reservations.map(row=>row.id));
  const details=await readNpayOrderMetadata({productOrderIds,request});
  if(details.missingProductOrderIds.length||details.orders.some(order=>!aliases.has(order.productId))
    ||new Set(details.orders.map(order=>order.productId)).size!==details.orders.length)throw failure(409);
  let inspection;
  if(inspectApi){
    const times=details.orders.flatMap(order=>[order.paymentDate,...order.completedClaims.map(claim=>claim.claimCompleteOperationDate)])
      .map(value=>Date.parse(value)).filter(Number.isFinite);
    const latest=Math.max(...times),now=clock();
    if(!times.length||!Number.isFinite(now)||latest>now)throw failure(409);
    const kst=value=>new Date(value+9*3600_000).toISOString().replace(/Z$/,'+09:00');
    const from=kst(latest-60_000),to=kst(Math.min(now,latest+60_000));
    const changes=await collectNpayChanges({from,to,request,maxPages:1});
    const knownIds=new Set(productOrderIds);
    inspection={changesCount:changes.changes.length,matchingProductOrderCount:changes.productOrderIds.filter(id=>knownIds.has(id)).length,
      coverageComplete:changes.coverageComplete,from,to,collectionFinal:false};
  }
  const settled=await reconcile(details.orders,{environment:'sandbox'});
  return{bound:settled.bound,updated:settled.updated,ignored:settled.ignored,incidents:settled.incidents.length,
    missing:0,changeCount:details.orders.length,cursorAdvanced:false,collectionFinal:false,scope:'sandbox-checkout',...(inspection?{inspection}:{})};
}
