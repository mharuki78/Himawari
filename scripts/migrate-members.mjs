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
]);

console.log('Member schema is ready.');
