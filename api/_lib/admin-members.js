import { database } from './database.js';

const pageSize = 25;
const statuses = ['active', 'disabled'];

export async function listMembers({ query = '', status = '', offset = 0 } = {}) {
  if (status && !statuses.includes(status)) throw Object.assign(new Error('회원 상태를 확인해 주세요.'), { status: 400 });
  const rows = await database().query(`
    SELECT u.id, u.email, u.display_name AS "displayName", u.status,
           u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
           ARRAY(SELECT DISTINCT a.provider FROM oauth_accounts a WHERE a.user_id = u.id ORDER BY a.provider) AS providers
    FROM users u
    WHERE ($1 = '' OR strpos(lower(coalesce(u.email, '')), lower($1)) > 0
                   OR strpos(lower(coalesce(u.display_name, '')), lower($1)) > 0)
      AND ($2 = '' OR u.status = $2)
    ORDER BY u.created_at DESC, u.id DESC LIMIT $3 OFFSET $4`,
  [query.trim().slice(0, 120), status, pageSize + 1, offset]);
  return { items: rows.slice(0, pageSize), nextOffset: rows.length > pageSize ? offset + pageSize : null };
}

export async function changeMemberStatus({ id, status, expectedStatus } = {}) {
  if (typeof id !== 'string' || !id || id.length > 120 || !statuses.includes(status) || !statuses.includes(expectedStatus) || status === expectedStatus) {
    throw Object.assign(new Error('변경할 회원과 상태를 확인해 주세요.'), { status: 400 });
  }
  const rows = await database().query(`
    WITH changed AS (
      UPDATE users SET status = $2, updated_at = now()
      WHERE id = $1 AND status = $3 RETURNING id, status
    ), revoked AS (
      DELETE FROM member_sessions WHERE user_id IN (SELECT id FROM changed WHERE status = 'disabled')
    )
    SELECT id, status FROM changed`, [id, status, expectedStatus]);
  if (!rows.length) throw Object.assign(new Error('회원 상태가 바뀌었거나 계정을 찾을 수 없습니다. 목록을 다시 불러와 주세요.'), { status: 409 });
  return { member: rows[0] };
}
