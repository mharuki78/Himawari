// Based on the authenticated order-type API 1.11.0 schema, not Commerce API.
// request(path, {method, body}) must be a server-only authenticated transport.
// This reader never writes reservations and never treats absence as finality.
const malformed = () => Object.assign(new Error('네이버페이 주문 응답을 확인할 수 없습니다.'), { status: 502 });
const text = value => typeof value === 'string' ? value : '';
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 150 && !/[\u0000-\u001f\u007f]/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
function kst(value) {
  if (typeof value !== 'string' || !value) throw malformed();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw malformed();
  return new Date(date.getTime() + 9 * 3600_000).toISOString().replace(/Z$/, '+09:00');
}

export async function collectNpayChanges({ from, to, request, maxPages = 10 }) {
  const start = kst(from), end = kst(to);
  if (Date.parse(end) < Date.parse(start) || Date.parse(end) - Date.parse(start) > 86400_000
    || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 100 || typeof request !== 'function') throw malformed();
  let cursorFrom = start, sequence = '';
  const cursors = new Set();
  const changes = [];
  let coverageComplete = true;
  for (let page = 0; page < maxPages; page++) {
    const cursor = JSON.stringify([cursorFrom, sequence]);
    if (cursors.has(cursor)) throw malformed();
    cursors.add(cursor);
    const query = new URLSearchParams({ lastChangedFrom: cursorFrom, lastChangedTo: end, limitCount: '1000' });
    if (sequence) query.set('moreSequence', sequence);
    const response = await request('/v1/pay-order/mall/product-orders/last-changed-statuses?' + query, { method: 'GET' });
    const data = response?.data;
    if (!data || !Array.isArray(data.lastChangeStatuses) || data.lastChangeStatuses.length > 1000 || integer(data.count) === null) throw malformed();
    // The docs allow filtered merchant rows but do not define count equality.
    // Preserve visible changes, conservatively withhold watermark advancement.
    if (data.count !== data.lastChangeStatuses.length) coverageComplete = false;
    for (const change of data.lastChangeStatuses) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) throw malformed();
      const when = Date.parse(change.lastChangedDate);
      if (!identifier(change.productOrderId) || !Number.isFinite(when) || when < Date.parse(start) || when > Date.parse(end)) throw malformed();
      changes.push({ productOrderId: change.productOrderId, orderId: text(change.orderId),
        lastChangedDate: change.lastChangedDate, lastChangedType: text(change.lastChangedType),
        productOrderStatus: text(change.productOrderStatus), claimType: text(change.claimType), claimStatus: text(change.claimStatus) });
    }
    const more = data.more;
    if (more == null || typeof more === 'object' && !Array.isArray(more) && Object.keys(more).length === 0) {
      return { changes, productOrderIds: [...new Set(changes.map(c => c.productOrderId))], through: coverageComplete ? end : null, coverageComplete, collectionFinal: false };
    }
    const next = Date.parse(more.moreFrom);
    if (!identifier(more.moreSequence) || !Number.isFinite(next) || next < Date.parse(cursorFrom) || next > Date.parse(end)) throw malformed();
    cursorFrom = kst(more.moreFrom); sequence = more.moreSequence;
  }
  // An incomplete window must not be committed as a completed polling cursor.
  throw malformed();
}

export async function readNpayOrderMetadata({ productOrderIds, request }) {
  if (!Array.isArray(productOrderIds) || productOrderIds.length > 10000 || productOrderIds.some(id => !identifier(id)) || typeof request !== 'function') throw malformed();
  const ids = [...new Set(productOrderIds)];
  const byId = new Map();
  for (let offset = 0; offset < ids.length; offset += 300) {
    const batch = ids.slice(offset, offset + 300);
    const response = await request('/v1/pay-order/mall/product-orders/query', { method: 'POST', body: { productOrderIds: batch } });
    if (!Array.isArray(response?.data) || response.data.length > batch.length) throw malformed();
    for (const entry of response.data) {
      const product = entry?.productOrder;
      if (!product || !batch.includes(product.productOrderId) || byId.has(product.productOrderId) || !identifier(product.productId)) throw malformed();
      if (entry.completedClaims != null && !Array.isArray(entry.completedClaims)) throw malformed();
      const claims = entry.completedClaims || [];
      if (claims.some(c => !c || typeof c !== 'object' || Array.isArray(c) || !identifier(c.claimId))) throw malformed();
      const initialQuantity = integer(product.initialQuantity), remainQuantity = integer(product.remainQuantity);
      byId.set(product.productOrderId, {
        orderId: text(entry.order?.orderId), productOrderId: product.productOrderId, productId: product.productId,
        optionManageCode: text(product.optionManageCode), productOrderStatus: text(product.productOrderStatus),
        initialQuantity, remainQuantity, unitPrice: integer(product.unitPrice), optionPrice: integer(product.optionPrice),
        quantityConfirmed: initialQuantity !== null && initialQuantity > 0 && remainQuantity !== null && remainQuantity <= initialQuantity,
        claimType: text(product.claimType), claimStatus: text(product.claimStatus), paymentDate: text(entry.order?.paymentDate),
        completedClaims: claims.map(claim => ({
          claimId: text(claim.claimId), claimType: text(claim.claimType), claimStatus: text(claim.claimStatus),
          requestQuantity: integer(claim.requestQuantity), claimCompleteOperationDate: text(claim.claimCompleteOperationDate),
        })),
      });
    }
  }
  return { orders: ids.flatMap(id => byId.has(id) ? [byId.get(id)] : []), missingProductOrderIds: ids.filter(id => !byId.has(id)), collectionFinal: false };
}
