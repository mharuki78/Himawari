import { createHmac } from 'node:crypto';
import { database, databaseIsConfigured } from './database.js';

export async function claimLoginAttempt(ip) {
  if (!databaseIsConfigured()) return true;
  const key = createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(String(ip)).digest('hex');
  const sql = database();
  await sql.query('CREATE TABLE IF NOT EXISTS admin_login_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL)');
  const rows = await sql.query(`INSERT INTO admin_login_limits(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN admin_login_limits.reset_at<=now() THEN 1 ELSE admin_login_limits.count+1 END,
    reset_at=CASE WHEN admin_login_limits.reset_at<=now() THEN now()+interval '15 minutes' ELSE admin_login_limits.reset_at END RETURNING count`, [key]);
  return Number(rows[0].count) <= 5;
}

export async function clearLoginAttempts(ip) {
  if (!databaseIsConfigured()) return;
  const key = createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(String(ip)).digest('hex');
  await database().query('DELETE FROM admin_login_limits WHERE key=$1', [key]);
}
