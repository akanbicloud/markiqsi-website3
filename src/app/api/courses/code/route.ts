import { hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { findCourse, money, validChoice, type Currency, type Format } from '@/lib/content/courses';
import { applyCode } from '@/lib/academy/codes';

/** Checks a discount or referral code and returns the new price (nothing is reserved). */
export async function POST(req: Request) {
  if (!hasDb()) return fail('Codes are not available right now.', 503);
  const b = await body(req);
  const course = findCourse(str(b.slug, 80));
  const format = str(b.format, 10) as Format;
  const currency = str(b.currency, 3) as Currency;
  if (!course || !['online', 'physical'].includes(format) || !['NGN', 'USD'].includes(currency) || !validChoice(format, currency)) return fail('Bad request.');
  const s = await getSession();
  const a = await applyCode(str(b.code, 40), course, format, currency, s?.uid ?? null);
  if (!a.ok) return fail(a.error);
  return json({ ok: true, code: a.code, label: a.label, now: money(a.now, currency), was: money(a.base, currency) });
}
