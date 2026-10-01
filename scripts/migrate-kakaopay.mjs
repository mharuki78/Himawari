import {neon} from '@neondatabase/serverless';
import {PAYMENT_SCHEMA_SQL} from '../api/_lib/kakaopay-store.js';
const url=process.env.DATABASE_URL_UNPOOLED;
if (!url || new URL(url).hostname.includes('-pooler')) throw Error('A direct DATABASE_URL_UNPOOLED is required.');
await neon(url).query(PAYMENT_SCHEMA_SQL);
console.log('KakaoPay payment schema ready. No orders or inventory changed.');
