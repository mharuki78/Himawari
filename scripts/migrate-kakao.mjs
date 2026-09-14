import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const sql=neon(process.env.DATABASE_URL);
await sql.transaction([sql`ALTER TABLE oauth_accounts DROP CONSTRAINT IF EXISTS oauth_accounts_provider_check`,sql`ALTER TABLE oauth_accounts ADD CONSTRAINT oauth_accounts_provider_check CHECK (provider IN ('naver','google','kakao'))`]);
console.log('Kakao provider schema ready');
