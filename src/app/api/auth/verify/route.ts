import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { sha256 } from '@/lib/crypto';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export async function POST(req: Request) {
  if (!hasDb()) return fail('The website database is not connected yet.', 503);
  const b = await body(req);
  const token = str(b.token, 200);
  if (!token) return fail('This link is not valid.');
  const q = await db();
  const rows = (await q`UPDATE mq_login_tokens SET used_at = now()
    WHERE token_hash = ${sha256(token)} AND used_at IS NULL AND expires_at > now()
    RETURNING email, name`) as { email: string; name: string | null }[];
  if (!rows.length) return fail('This link has expired or was already used. Please request a new one.', 410);
  const { email, name } = rows[0];
  const users = (await q`INSERT INTO mq_users (email, name, last_login_at) VALUES (${email}, ${name}, now())
    ON CONFLICT (email) DO UPDATE SET last_login_at = now(), name = COALESCE(mq_users.name, EXCLUDED.name)
    RETURNING id, onboarded`) as { id: number; onboarded: boolean }[];
  const u = users[0];
  const res = json({ ok: true, next: u.onboarded ? '/account' : '/welcome' });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ uid: Number(u.id), email }), sessionCookieOptions);
  return res;
}
