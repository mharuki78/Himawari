import { database } from './database.js';

let schemaPromise;

// No customer/local-order placeholders: a Npay checkout owns its own holds.
export function ensureNpayReservationSchema() {
  if (!schemaPromise) {
    const sql = database();
    schemaPromise = sql.transaction(tx => [
      tx`CREATE TABLE IF NOT EXISTS npay_checkouts (
        id text PRIMARY KEY,
        request_id text NOT NULL UNIQUE,
        fingerprint text NOT NULL,
        catalog_revision integer NOT NULL DEFAULT 0,
        environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
        phase text NOT NULL DEFAULT 'reserved' CHECK (phase IN ('reserved','registering','registered','uncertain','blocked')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      tx`ALTER TABLE npay_checkouts ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production'))`,
      tx`CREATE TABLE IF NOT EXISTS npay_inventory_reservations (
        id text PRIMARY KEY,
        checkout_id text NOT NULL REFERENCES npay_checkouts(id),
        product_id text NOT NULL,
        option_id text NOT NULL DEFAULT '',
        quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
        held_quantity integer NOT NULL CHECK (held_quantity BETWEEN 0 AND quantity),
        campaign_id text,
        offer_id text,
        campaign_revision integer,
        unit_price integer NOT NULL CHECK (unit_price > 0),
        regular_price integer NOT NULL CHECK (regular_price >= unit_price),
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((campaign_id IS NULL) = (offer_id IS NULL)),
        UNIQUE(checkout_id, product_id, option_id)
      )`,
      tx`CREATE INDEX IF NOT EXISTS npay_reservations_stock_idx ON npay_inventory_reservations(product_id,option_id) WHERE held_quantity>0`,
    ]).catch(error => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

// All callers initialize the schema before using this relation. Retired or
// expired Npay checkout identities still hold stock until terminal evidence.
// Keep historical parent-only campaign attribution for local orders.
export const ALL_INVENTORY_RESERVATIONS = `
  SELECT r.order_id, r.product_id, r.option_id, r.quantity, r.active,
    COALESCE(to_jsonb(r)->>'black_friday_id',
      CASE WHEN to_jsonb(o)->>'black_friday_offer_id' IS NOT NULL OR NOT (to_jsonb(o) ? 'black_friday_offer_id')
        THEN to_jsonb(o)->>'black_friday_id' END) AS black_friday_id
  FROM inventory_reservations r LEFT JOIN orders o ON o.id=r.order_id
  UNION ALL
  SELECT NULL::text AS order_id, product_id, option_id, held_quantity AS quantity,
    held_quantity>0 AS active, campaign_id AS black_friday_id
  FROM npay_inventory_reservations`;

// Public physical stock does not need local order/campaign attribution.
export const PHYSICAL_INVENTORY_RESERVATIONS = `
  SELECT product_id,option_id,quantity,active FROM inventory_reservations
  UNION ALL
  SELECT product_id,option_id,held_quantity AS quantity,held_quantity>0 AS active FROM npay_inventory_reservations`;
