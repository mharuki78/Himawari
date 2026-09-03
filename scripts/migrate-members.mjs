import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = neon(process.env.DATABASE_URL);

await sql.transaction((tx) => [
  tx`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text,
    display_name text,
    avatar_url text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`,
  tx`CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider text NOT NULL CHECK (provider IN ('naver', 'google')),
    provider_user_id text NOT NULL,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
  )`,
  tx`CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts(user_id)`,
  tx`CREATE TABLE IF NOT EXISTS member_sessions (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  tx`CREATE INDEX IF NOT EXISTS member_sessions_user_id_idx ON member_sessions(user_id)`,
  tx`CREATE INDEX IF NOT EXISTS member_sessions_expires_at_idx ON member_sessions(expires_at)`,
  tx`CREATE TABLE IF NOT EXISTS cart_items (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,
  tx`CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,
  tx`CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    order_number text NOT NULL UNIQUE,
    request_id text NOT NULL UNIQUE,
    user_id text REFERENCES users(id) ON DELETE SET NULL,
    member_email text,
    recipient_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    postal_code text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    delivery_note text,
    subtotal integer NOT NULL CHECK (subtotal >= 0),
    shipping_fee integer NOT NULL CHECK (shipping_fee >= 0),
    total integer NOT NULL CHECK (total >= 0),
    payment_method text NOT NULL DEFAULT 'provider_pending',
    status text NOT NULL DEFAULT 'payment_pending' CHECK (status IN (
      'payment_pending', 'confirmed', 'preparing', 'shipped', 'delivered',
      'cancel_requested', 'cancelled', 'refund_requested', 'refunded'
    )),
    carrier text NOT NULL DEFAULT '로젠택배',
    tracking_number text,
    revision integer NOT NULL DEFAULT 1,
    terms_agreed_at timestamptz NOT NULL,
    privacy_agreed_at timestamptz NOT NULL,
    retention_until timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  tx`CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC)`,
  tx`CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC)`,
  tx`CREATE INDEX IF NOT EXISTS orders_retention_idx ON orders(retention_until)`,
  tx`CREATE TABLE IF NOT EXISTS order_items (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    product_name text NOT NULL,
    product_model text NOT NULL,
    unit_price integer NOT NULL CHECK (unit_price >= 0),
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    line_total integer NOT NULL CHECK (line_total >= 0),
    image_url text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  tx`CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id, created_at)`,
  tx`CREATE TABLE IF NOT EXISTS order_events (
    id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor text NOT NULL CHECK (actor IN ('member', 'admin', 'system')),
    from_status text,
    to_status text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  tx`CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at)`,
]);

console.log('Member and order schema is ready.');
