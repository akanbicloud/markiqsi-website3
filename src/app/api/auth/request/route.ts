import { safeError } from '@/lib/http';
import { db, hasDb } from '@/lib/db';
import { body, fail, isEmail, json, str } from '@/lib/http';
import { randomToken, sha256 } from '@/lib/crypto';
import { sendLoginEmail } from '@/lib/email';
import { SITE } from '@/lib/site';

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error('signup/login request', safeError(e));
    return fail(`Sign-up is not working right now (${safeError(e).slice(0, 120)}). Please try again shortly.`, 500);
  }
}

async function handle(req: Request) {
  if (!hasDb()) return fail('The website database is not connected yet.', 503);
  const b = await body(req);
  const mode = b.mode === 'login' ? 'login' : 'signup';
  const email = str(b.email, 254).toLowerCase();
  const name = str(b.name, 80);
  if (!isEmail(email)) return fail('Please enter a valid email address.');
  if (mode === 'signup') {
    if (!name) return fail('Please enter your name.');
    if (b.agree !== true) return fail('Please tick the box to agree to the Terms and Privacy Policy.');
  }
  const q = await db();
  const recent = (await q`SELECT count(*)::int AS n FROM mq_login_tokens WHERE email = ${email} AND created_at > now() - interval '1 hour'`) as { n: number }[];
  if (recent[0].n >= 5) return fail('Too many links requested. Please wait a few minutes and check your inbox.', 429);

  const existing = (await q`SELECT id FROM mq_users WHERE email = ${email}`) as { id: number }[];
  const purpose = existing.length ? 'login' : 'signup';
  const token = randomToken();
  await q`INSERT INTO mq_login_tokens (token_hash, email, name, purpose, expires_at) VALUES (${sha256(token)}, ${email}, ${name || null}, ${purpose}, now() + interval '15 minutes')`;

  const base = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  const link = `${base}/auth/confirm?token=${encodeURIComponent(token)}`;
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production') return json({ ok: true, devLink: link, purpose });
    return fail('Email sending is not set up yet. Please try again later.', 503);
  }
  try {
    await sendLoginEmail(email, link, purpose, name || null);
  } catch (e) {
    console.error('email failed', safeError(e));
    return fail(`We could not send the email. Please try again, or contact ${SITE.email}.`, 502);
  }
  return json({ ok: true, purpose });
}
