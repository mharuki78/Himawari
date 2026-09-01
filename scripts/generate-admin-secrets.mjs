import { randomBytes, scryptSync } from 'node:crypto';

const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, 64);
const passwordHash = `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
const sessionSecret = randomBytes(48).toString('base64url');

console.log('아래 비밀번호는 다시 표시되지 않습니다. 안전한 비밀번호 관리자에 보관하세요.');
console.log(`ADMIN_PASSWORD=${password}`);
console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
