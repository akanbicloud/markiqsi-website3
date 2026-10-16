import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isAdminEmail } from '@/lib/academy/admin';
import { normalizeCode, validCodeShape } from '@/lib/academy/codes';
import { COURSES } from '@/lib/content/courses';

async function admin() {
  const s = await getSession();
  return s && isAdminEmail(s.email) ? s : null;
}

/** Create a discount code, or switch one on/off. */
export async function POST(req: Request) {
  const s = await admin();
  if (!s) return fail('Not allowed.', 403);
  if (!hasDb()) return fail('Database not connected.', 503);
  const b = await body(req);
  const q = await db();
  const code = normalizeCode(b.code);
  if (!validCodeShape(code)) return fail('Codes use 3 to 24 letters, numbers, - or _.');

  if (b.action === 'toggle') {
    await q`UPDATE mq_codes SET active = NOT active WHERE code = ${code}`;
    return json({ ok: true });
  }

  const percent = b.percent === '' || b.percent == null ? null : Math.round(Number(b.percent));
  const amountNgn = b.amount_ngn === '' || b.amount_ngn == null ? null : Math.round(Number(b.amount_ngn));
  const amountUsd = b.amount_usd === '' || b.amount_usd == null ? null : Math.round(Number(b.amount_usd));
  if (percent != null && !(percent >= 1 && percent <= 90)) return fail('Percent must be between 1 and 90.');
  if (percent == null && !amountNgn && !amountUsd) return fail('Set a percent, or a Naira and/or dollar amount off.');
  if ((amountNgn != null && !(amountNgn > 0)) || (amountUsd != null && !(amountUsd > 0))) return fail('Amounts must be more than zero.');
  const courses = (Array.isArray(b.courses) ? b.courses : []).map((x: unknown) => str(x, 80)).filter((x: string) => COURSES.some((c) => c.slug === x));
  const maxUses = b.max_uses === '' || b.max_uses == null ? null : Math.max(1, Math.round(Number(b.max_uses)));
  const expires = str(b.expires_on, 10);
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expires) ? `${expires}T23:59:59+01:00` : null;
  const rows = (await q`INSERT INTO mq_codes (code, kind, percent, amount_ngn, amount_usd, courses, max_uses, expires_at, note)
    VALUES (${code}, 'discount', ${percent}, ${percent != null ? null : amountNgn}, ${percent != null ? null : amountUsd}, ${courses.length ? courses : null}, ${maxUses}, ${expiresAt}, ${str(b.note, 120) || null})
    ON CONFLICT (code) DO NOTHING RETURNING code`) as { code: string }[];
  if (!rows[0]) return fail('That code already exists. Choose another one.');
  return json({ ok: true, code });
}
