import {createHash} from 'node:crypto';
import {database} from './database.js';
import {decryptSandboxEnvelope} from './npay-credentials.js';
import {npayReviewTokenIsValid,npayReviewSessionCookie} from './npay.js';

export async function redeemSandboxSession(ticket){
  if(process.env.VERCEL_ENV!=='preview'||typeof ticket!=='string'||ticket.length>1024)return null;
  try{
    const data=decryptSandboxEnvelope(ticket);
    const remaining=data.expiresAt-Date.now();
    if(data.type!=='sandbox-entry'||! /^[a-f0-9]{32}$/.test(data.nonce)||!Number.isSafeInteger(data.expiresAt)||remaining<=0||remaining>3600_000||!npayReviewTokenIsValid(data.token))return null;
    const sql=database();
    await sql`CREATE TABLE IF NOT EXISTS npay_sandbox_sessions (nonce_sha256 text PRIMARY KEY,used_at timestamptz NOT NULL DEFAULT now())`;
    const nonce=createHash('sha256').update(data.nonce).digest('hex');
    const rows=await sql`INSERT INTO npay_sandbox_sessions(nonce_sha256) VALUES(${nonce}) ON CONFLICT DO NOTHING RETURNING nonce_sha256`;
    return rows.length?npayReviewSessionCookie(data.token)+'; Max-Age=3600':null;
  }catch{return null;}
}
