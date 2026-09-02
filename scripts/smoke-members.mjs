import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createMemberSession, deleteMemberAccount, upsertOAuthUser } from '../api/_lib/member-auth.js';
import { fetch as accountHandler } from '../api/member/account.js';
import { fetch as cartHandler } from '../api/member/cart.js';
import { fetch as wishlistHandler } from '../api/member/wishlist.js';
import { seedCatalog } from '../api/_lib/products.js';
import { database } from '../api/_lib/database.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!process.env.MEMBER_SESSION_SECRET) process.env.MEMBER_SESSION_SECRET = randomUUID() + randomUUID();

const smokeId = randomUUID();
let user;
let deleted = false;

await database().query(
  `DELETE FROM users WHERE id IN (
     SELECT user_id FROM oauth_accounts WHERE provider_user_id LIKE 'smoke-%'
   )`,
);

function request(path, method = 'GET', body, cookie = '') {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      Origin: 'http://localhost:3000',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

try {
  user = await upsertOAuthUser({
    provider: 'google',
    providerUserId: `smoke-${smokeId}`,
    email: `smoke-${smokeId}@example.invalid`,
    displayName: 'Himawari smoke test',
    avatarUrl: '',
  });
  const sessionCookie = await createMemberSession(request('/api/auth/callback/google'), user.id);
  const cookie = sessionCookie.split(';')[0];
  const productId = seedCatalog().products[0].id;

  const cartPut = await cartHandler(request('/api/member/cart', 'PUT', {
    items: [{ productId, quantity: 2 }],
  }, cookie));
  assert.equal(cartPut.status, 200);
  assert.equal((await cartPut.json()).items[0].quantity, 2);

  const wishlistPut = await wishlistHandler(request('/api/member/wishlist', 'PUT', {
    productIds: [productId],
  }, cookie));
  assert.equal(wishlistPut.status, 200);
  assert.equal((await wishlistPut.json()).items[0].productId, productId);

  const accountDelete = await accountHandler(request('/api/member/account', 'DELETE', {
    confirmation: '회원탈퇴',
  }, cookie));
  assert.equal(accountDelete.status, 200);
  deleted = true;

  const afterDelete = await cartHandler(request('/api/member/cart', 'GET', undefined, cookie));
  assert.equal(afterDelete.status, 401);
  console.log('Member database smoke test passed and test data was deleted.');
} finally {
  if (user && !deleted) await deleteMemberAccount(user.id);
}
