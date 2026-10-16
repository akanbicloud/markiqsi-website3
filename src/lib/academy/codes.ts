import { db } from '../db';
import { money, priceFor, type Course, type Currency, type Format } from '../content/courses';
import { randomInt } from 'crypto';

/**
 * Discount codes (created by the owner) and referral codes (one per student).
 * A referral code gives the friend REFERRAL_PERCENT off (default 10%); the owner sees who enrolled
 * with each code and decides any reward. Codes are counted as "used" only when a payment is confirmed.
 */

export type CodeRow = {
  code: string; kind: 'discount' | 'referral'; percent: number | null; amount_ngn: number | null; amount_usd: number | null;
  courses: string[] | null; max_uses: number | null; used: number; expires_at: string | null; owner_user_id: number | null; active: boolean; note: string | null;
};

export const referralPercent = () => Math.max(1, Math.min(50, Number(process.env.REFERRAL_PERCENT) || 10));

export function normalizeCode(v: unknown): string {
  return String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
}
export const validCodeShape = (c: string) => /^[A-Z0-9_-]{3,24}$/.test(c);

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The price after a code. Never below ₦1,000 / $1. */
export function discounted(base: number, currency: Currency, c: Pick<CodeRow, 'percent' | 'amount_ngn' | 'amount_usd'>) {
  let off = 0;
  if (c.percent) off = currency === 'USD' ? Math.round((base * c.percent) / 100) : roundTo((base * c.percent) / 100, 500);
  else if (currency === 'NGN' && c.amount_ngn) off = c.amount_ngn;
  else if (currency === 'USD' && c.amount_usd) off = c.amount_usd;
  const floor = currency === 'USD' ? 1 : 1000;
  const now = Math.max(floor, base - off);
  return { now, off: base - now };
}

export type Applied = { ok: true; code: string; kind: CodeRow['kind']; base: number; now: number; off: number; label: string; referrer: number | null } | { ok: false; error: string };

export async function applyCode(raw: unknown, course: Course, format: Format, currency: Currency, userId: number | null): Promise<Applied> {
  const code = normalizeCode(raw);
  if (!validCodeShape(code)) return { ok: false, error: 'That code does not look right. Check it and try again.' };
  const q = await db();
  const rows = (await q`SELECT * FROM mq_codes WHERE code = ${code}`) as CodeRow[];
  const c = rows[0];
  if (!c || !c.active) return { ok: false, error: 'That code is not valid.' };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, error: 'That code has expired.' };
  if (c.max_uses != null && c.used >= c.max_uses) return { ok: false, error: 'That code has been fully used.' };
  if (c.courses && c.courses.length && !c.courses.includes(course.slug)) return { ok: false, error: 'That code is not for this course.' };
  if (c.kind === 'referral' && userId && Number(c.owner_user_id) === userId) return { ok: false, error: 'You cannot use your own referral code. Share it with a friend instead.' };
  const base = priceFor(course, format, currency).now;
  const { now, off } = discounted(base, currency, c);
  if (off <= 0) return { ok: false, error: 'That code does not lower the price of this class.' };
  const label = c.percent ? `${c.percent}% off` : `${money(off, currency)} off`;
  return { ok: true, code, kind: c.kind, base, now, off, label, referrer: c.kind === 'referral' ? Number(c.owner_user_id) : null };
}

/** The student's own referral code (created the first time it is needed). */
export async function referralCodeFor(user: { id: number; name: string | null; email: string }): Promise<string> {
  const q = await db();
  const have = (await q`SELECT code FROM mq_codes WHERE owner_user_id = ${user.id} AND kind = 'referral'`) as { code: string }[];
  if (have[0]) return have[0].code;
  const stem = ((user.name || user.email.split('@')[0]).replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'MARKIQ');
  for (let i = 0; i < 6; i++) {
    const code = `${stem}${randomInt(100, 1000)}`;
    const ins = (await q`INSERT INTO mq_codes (code, kind, percent, owner_user_id, note)
      VALUES (${code}, 'referral', ${referralPercent()}, ${user.id}, 'Personal referral code')
      ON CONFLICT DO NOTHING RETURNING code`) as { code: string }[];
    if (ins[0]) return ins[0].code;
    const again = (await q`SELECT code FROM mq_codes WHERE owner_user_id = ${user.id} AND kind = 'referral'`) as { code: string }[];
    if (again[0]) return again[0].code;
  }
  throw new Error('Could not create a referral code');
}

export async function referralStats(userId: number) {
  const q = await db();
  const rows = (await q`SELECT count(*)::int AS n FROM mq_enrolments WHERE referrer_user_id = ${userId} AND status = 'active'`) as { n: number }[];
  return rows[0]?.n || 0;
}

/** Called when a payment is confirmed: counts the code once. */
export async function countCodeUse(enrolmentId: number) {
  const q = await db();
  const rows = (await q`UPDATE mq_enrolments SET code_counted = TRUE WHERE id = ${enrolmentId} AND code IS NOT NULL AND code_counted = FALSE RETURNING code`) as { code: string }[];
  if (rows[0]) await q`UPDATE mq_codes SET used = used + 1 WHERE code = ${rows[0].code}`;
}
