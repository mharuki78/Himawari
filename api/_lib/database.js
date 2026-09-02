import { neon } from '@neondatabase/serverless';

let client;

export function databaseIsConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function database() {
  if (!databaseIsConfigured()) {
    throw Object.assign(new Error('회원 데이터베이스가 연결되지 않았습니다.'), { status: 503 });
  }
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

