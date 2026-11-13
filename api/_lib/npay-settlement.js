import { database } from './database.js';
import { INVENTORY_LOCK } from './black-friday.js';
import { ensureNpayReservationSchema } from './inventory-reservation-store.js';
import { npayOptionManageCode } from './npay.js';

const reservedId = value => typeof value === 'string' && /^NPR-[0-9a-f]{24}$/.test(value);
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 150 && !/[\u0000-\u001f\u007f]/.test(value);
const quantity = value => Number.isSafeInteger(value) && value >= 0;
// Unknown provider states deliberately require an operator/code review. These
// guards deliberately cover only the known mall order states. New states must
// be checked against the merchant's exact mall API version before adding them.
const orderRanks = new Map(['PAYMENT_WAITING', 'PAYED', 'DELIVERING', 'DELIVERED', 'PURCHASE_DECIDED', 'EXCHANGED', 'RETURNED', 'CANCELED'].map((state, index) => [state, index]));
const claimTypes = new Set(['', 'CANCEL', 'RETURN', 'EXCHANGE', 'PURCHASE_DECISION_HOLDBACK', 'ADMIN_CANCEL']);
const claimStatuses = new Set(['', 'CANCEL_REQUEST', 'CANCELING', 'CANCEL_DONE', 'CANCEL_REJECT',
  'RETURN_REQUEST', 'COLLECTING', 'COLLECT_DONE', 'RETURN_DONE', 'RETURN_REJECT',
  'EXCHANGE_REQUEST', 'EXCHANGE_REDELIVERING', 'EXCHANGE_DONE', 'EXCHANGE_REJECT',
  'PURCHASE_DECISION_HOLDBACK', 'PURCHASE_DECISION_HOLDBACK_RELEASE']);
const invalid = reason => ({ valid: false, incident: reason });
let schemaPromise;

export function ensureNpaySettlementSchema() {
  if (!schemaPromise) schemaPromise = ensureNpayReservationSchema().then(() => database().transaction(tx => [tx`CREATE TABLE IF NOT EXISTS npay_provider_lines (
    product_order_id text PRIMARY KEY,
    reservation_id text NOT NULL UNIQUE REFERENCES npay_inventory_reservations(id),
    order_id text NOT NULL,
    initial_quantity integer NOT NULL CHECK(initial_quantity BETWEEN 1 AND 999),
    canceled_quantity integer NOT NULL DEFAULT 0 CHECK(canceled_quantity BETWEEN 0 AND initial_quantity),
    cancellation_claims jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(cancellation_claims)='array'),
    non_cancellation_claims jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(non_cancellation_claims)='array'),
    product_order_status text NOT NULL,
    claim_type text NOT NULL DEFAULT '',
    claim_status text NOT NULL DEFAULT '',
    revision integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`, tx`ALTER TABLE npay_provider_lines ADD COLUMN IF NOT EXISTS non_cancellation_claims jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(non_cancellation_claims)='array')`
  ])).catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

// Consume only the server-side authenticated reader's projection. This helper
// does not authenticate a payload; it must never be wired to a public webhook.
// No expiry, absence, return or reduction at checkout proves stock is reusable.
export function projectNpayOrderSettlement(reservation, order, previous = null) {
  if (!reservedId(reservation?.id) || order?.productId !== reservation.id
    || !identifier(order.orderId) || !identifier(order.productOrderId)) return invalid('identity_mismatch');
  if (!orderRanks.has(order.productOrderStatus) || !claimTypes.has(order.claimType) || !claimStatuses.has(order.claimStatus)) return invalid('unknown_state');
  const expectedOption = reservation.option_id ? npayOptionManageCode({ id: reservation.id }, { id: reservation.option_id }) : '';
  if (order.optionManageCode !== expectedOption || order.unitPrice !== reservation.unit_price || order.optionPrice !== 0) return invalid('price_or_option_mismatch');
  if (order.quantityConfirmed !== true || !quantity(order.initialQuantity) || order.initialQuantity < 1
    || !quantity(order.remainQuantity) || order.remainQuantity > order.initialQuantity
    || !quantity(reservation.quantity) || order.initialQuantity > reservation.quantity
    || !quantity(reservation.held_quantity) || reservation.held_quantity > reservation.quantity) return invalid('quantity_mismatch');
  if (previous && (previous.reservation_id !== reservation.id || previous.product_order_id !== order.productOrderId
    || previous.order_id !== order.orderId || previous.initial_quantity !== order.initialQuantity)) return invalid('binding_conflict');
  const oldCanceled = previous?.canceled_quantity ?? 0;
  if (!quantity(oldCanceled) || oldCanceled > order.initialQuantity
    || reservation.held_quantity !== reservation.quantity - oldCanceled) return invalid('hold_mismatch');
  if (!Array.isArray(order.completedClaims) || order.completedClaims.length > 1000) return invalid('invalid_claims');
  const claims = new Map((previous?.cancellation_claims || []).map(c => [c.claimId, c.quantity]));
  const nonCancellationClaims = new Map((previous?.non_cancellation_claims || []).map(c => [c.claimId, c]));
  const seenClaims = new Map([
    ...[...claims].map(([claimId, count]) => [claimId, { claimType: 'CANCEL', quantity: count }]),
    ...nonCancellationClaims,
  ]);
  const incomingClaims = new Map();
  for (const claim of order.completedClaims) {
    if (!claim || !identifier(claim.claimId) || !claimTypes.has(claim.claimType) || !claimStatuses.has(claim.claimStatus)
      || !quantity(claim.requestQuantity) || claim.requestQuantity < 1 || claim.requestQuantity > order.initialQuantity) return invalid('invalid_claims');
    const known = seenClaims.get(claim.claimId);
    if (known && (known.claimType !== claim.claimType || known.quantity !== claim.requestQuantity)) return invalid('claim_identity_changed');
    seenClaims.set(claim.claimId, { claimType: claim.claimType, quantity: claim.requestQuantity });
    if (claim.claimType !== 'CANCEL' || claim.claimStatus !== 'CANCEL_DONE') {
      nonCancellationClaims.set(claim.claimId, { claimId: claim.claimId, claimType: claim.claimType, quantity: claim.requestQuantity });
      continue;
    }
    if (!Number.isFinite(Date.parse(claim.claimCompleteOperationDate))) return invalid('invalid_claims');
    if (claims.has(claim.claimId) && claims.get(claim.claimId) !== claim.requestQuantity) return invalid('claim_quantity_changed');
    claims.set(claim.claimId, claim.requestQuantity);
    incomingClaims.set(claim.claimId, claim.requestQuantity);
  }
  if ([...incomingClaims.values()].reduce((sum, count) => sum + count, 0) > order.initialQuantity - order.remainQuantity) return invalid('inconsistent_cancellation_quantity');
  const claimedCanceled = [...claims.values()].reduce((sum, count) => sum + count, 0);
  if (claimedCanceled > order.initialQuantity) return invalid('cancellation_exceeds_purchase');
  const protectedQuantity = [...nonCancellationClaims.values()].reduce((sum, claim) => sum + claim.quantity, 0);
  if (Math.max(oldCanceled, claimedCanceled) + protectedQuantity > order.initialQuantity) return invalid('contradictory_completed_claims');
  // Full cancellation needs an explicit completed cancellation state. A lower
  // remainQuantity by itself cannot prove a release or collection finality.
  // A zero remainder can combine canceled and returned/exchanged units. Keep
  // non-cancellation evidence across polls, since omission is not finality.
  const nonCancellationEvidence = nonCancellationClaims.size > 0
    || [order.productOrderStatus, previous?.product_order_status].some(state => ['RETURNED', 'EXCHANGED'].includes(state))
    || [order.claimType, previous?.claim_type].some(type => ['RETURN', 'EXCHANGE'].includes(type));
  const fullCancellation = !nonCancellationEvidence && order.remainQuantity === 0 && (order.productOrderStatus === 'CANCELED'
    || order.claimType === 'CANCEL' && order.claimStatus === 'CANCEL_DONE');
  const canceledQuantity = Math.max(oldCanceled, claimedCanceled, fullCancellation ? order.initialQuantity : 0);
  const oldRank = orderRanks.get(previous?.product_order_status) ?? -1;
  const stale = oldRank > orderRanks.get(order.productOrderStatus)
    || ['CANCELED', 'RETURNED', 'EXCHANGED'].includes(previous?.product_order_status) && previous.product_order_status !== order.productOrderStatus;
  const terminalClaim = ['CANCEL_DONE', 'RETURN_DONE', 'EXCHANGE_DONE'].includes(previous?.claim_status);
  const line = {
    product_order_id: order.productOrderId, reservation_id: reservation.id, order_id: order.orderId,
    initial_quantity: order.initialQuantity, canceled_quantity: canceledQuantity,
    cancellation_claims: [...claims].sort(([a], [b]) => a.localeCompare(b)).map(([claimId, count]) => ({ claimId, quantity: count })),
    non_cancellation_claims: [...nonCancellationClaims.values()].sort((a, b) => a.claimId.localeCompare(b.claimId)),
    product_order_status: stale ? previous.product_order_status : order.productOrderStatus,
    claim_type: stale || terminalClaim ? previous.claim_type : order.claimType,
    claim_status: stale || terminalClaim ? previous.claim_status : order.claimStatus,
  };
  const changed = !previous || Object.entries(line).some(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value));
  return { valid: true, line, heldQuantity: reservation.quantity - canceledQuantity, changed };
}

// Internal authenticated-reader consumer. Return only aggregate counts and safe
// incident codes; order identifiers/payloads must not enter public responses or
// logs. A bounded optimistic retry makes pre-read projections safe with Neon's
// non-interactive batch transactions: validate the snapshot again under the
// same inventory lock used by ordinary orders and the reservation allocator.
export async function reconcileNpayOrderMetadata(orders, { environment = 'sandbox' } = {}) {
  if (!Array.isArray(orders) || orders.length > 10000 || !['sandbox', 'production'].includes(environment)) throw Object.assign(new Error('Invalid Npay settlement batch.'), { status: 400 });
  await ensureNpaySettlementSchema();
  const sql = database();
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = { bound: 0, updated: 0, ignored: 0, incidents: [] };
    const ids = [...new Set(orders.map(order => order?.productId).filter(reservedId))];
    if (!ids.length) return { ...result, ignored: orders.length };
    const [reservations, previousLines] = await Promise.all([
      sql.query(`SELECT r.*,c.environment FROM npay_inventory_reservations r
        JOIN npay_checkouts c ON c.id=r.checkout_id WHERE r.id=ANY($1::text[])`, [ids]),
      sql.query('SELECT * FROM npay_provider_lines WHERE reservation_id=ANY($1::text[]) OR product_order_id=ANY($2::text[])',
        [ids, orders.map(order => order?.productOrderId).filter(identifier)]),
    ]);
    const byReservation = new Map(reservations.map(row => [row.id, row]));
    const linesByReservation = new Map(previousLines.map(row => [row.reservation_id, row]));
    const linesById = new Map(previousLines.map(row => [row.product_order_id, row]));
    const pending = new Map();
    for (const order of orders) {
      const reservation = byReservation.get(order?.productId);
      if (!reservation) { result.ignored++; continue; }
      if (reservation.environment !== environment) { result.incidents.push({ reason: 'environment_mismatch' }); continue; }
      const previous = linesByReservation.get(reservation.id);
      if (previous && previous.product_order_id !== order.productOrderId
        || linesById.has(order.productOrderId) && linesById.get(order.productOrderId).reservation_id !== reservation.id) {
        result.incidents.push({ reason: 'binding_conflict' }); continue;
      }
      const projection = projectNpayOrderSettlement(reservation, order, previous);
      if (!projection.valid) { result.incidents.push({ reason: projection.incident }); continue; }
      if (!projection.changed) { result.ignored++; continue; }
      // Repeated entries in one reader result are not a second binding. Reject
      // conflicting duplicate metadata rather than choosing an arbitrary winner.
      if (pending.has(reservation.id)) {
        if (JSON.stringify(pending.get(reservation.id).projection.line) !== JSON.stringify(projection.line)) {
          pending.get(reservation.id).conflict = true;
          result.incidents.push({ reason: 'conflicting_batch_entries' });
        } else result.ignored++;
        continue;
      }
      pending.set(reservation.id, { reservation, previous, projection });
    }
    const queries = [sql.query(INVENTORY_LOCK)];
    for (const { reservation, previous, projection, conflict } of pending.values()) {
      if (conflict) continue;
      const line = projection.line;
      queries.push(sql.query(`SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM npay_inventory_reservations r
        JOIN npay_checkouts c ON c.id=r.checkout_id
        WHERE r.id=$1 AND r.held_quantity=$2 AND r.quantity=$3 AND r.unit_price=$4 AND r.option_id=$5 AND r.checkout_id=$6 AND c.environment=$7)
        AND ${previous ? 'EXISTS(SELECT 1 FROM npay_provider_lines WHERE product_order_id=$8 AND revision=$9)' :
          'NOT EXISTS(SELECT 1 FROM npay_provider_lines WHERE product_order_id=$8 OR reservation_id=$1)'}
        THEN 1 ELSE 0 END`, [reservation.id, reservation.held_quantity, reservation.quantity, reservation.unit_price,
        reservation.option_id, reservation.checkout_id, environment, line.product_order_id, ...(previous ? [previous.revision] : [])]));
      if (previous) {
        queries.push(sql`UPDATE npay_provider_lines SET canceled_quantity=${line.canceled_quantity},
          cancellation_claims=${JSON.stringify(line.cancellation_claims)}::jsonb,
          non_cancellation_claims=${JSON.stringify(line.non_cancellation_claims)}::jsonb, product_order_status=${line.product_order_status},
          claim_type=${line.claim_type},claim_status=${line.claim_status},revision=revision+1,updated_at=now()
          WHERE product_order_id=${line.product_order_id}`);
        result.updated++;
      } else {
        queries.push(sql`INSERT INTO npay_provider_lines(product_order_id,reservation_id,order_id,initial_quantity,
          canceled_quantity,cancellation_claims,non_cancellation_claims,product_order_status,claim_type,claim_status)
          VALUES(${line.product_order_id},${line.reservation_id},${line.order_id},${line.initial_quantity},
          ${line.canceled_quantity},${JSON.stringify(line.cancellation_claims)}::jsonb,${JSON.stringify(line.non_cancellation_claims)}::jsonb,
          ${line.product_order_status},${line.claim_type},${line.claim_status})`);
        result.bound++;
      }
      queries.push(sql`UPDATE npay_inventory_reservations SET held_quantity=${projection.heldQuantity} WHERE id=${reservation.id}`);
      queries.push(sql`UPDATE npay_checkouts SET phase='blocked',updated_at=now() WHERE id=${reservation.checkout_id} AND phase<>'blocked'`);
    }
    if (queries.length === 1) return result;
    try { await sql.transaction(queries, { isolationLevel: 'ReadCommitted' }); return result; }
    catch (error) {
      if (!['22012', '23505'].includes(error.code)) throw error;
      if (attempt === 2) return { bound: 0, updated: 0, ignored: result.ignored, incidents: [...result.incidents, { reason: 'concurrent_settlement_conflict' }] };
    }
  }
}
