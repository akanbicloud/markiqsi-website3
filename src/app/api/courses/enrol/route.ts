import { db, hasDb } from '@/lib/db';
import { body, fail, json, safeError, str } from '@/lib/http';
import { randomToken } from '@/lib/crypto';
import { getSession } from '@/lib/session';
import { SITE } from '@/lib/site';
import { findCourse, money, priceFor, validChoice, type Currency, type Format } from '@/lib/content/courses';
import { initializePayment, paystackCurrencies, paystackReady } from '@/lib/academy/paystack';
import { applyCode } from '@/lib/academy/codes';

export async function POST(req: Request) {
  if (!hasDb()) return fail('Enrolment is not connected yet. Please message us on WhatsApp.', 503);
  const s = await getSession();
  if (!s) return fail('Please sign in to enrol.', 401);
  const b = await body(req);
  const course = findCourse(str(b.slug, 80));
  const format = str(b.format, 10) as Format;
  const currency = str(b.currency, 3) as Currency;
  if (!course) return fail('Course not found.', 404);
  if (!['online', 'physical'].includes(format) || !['NGN', 'USD'].includes(currency) || !validChoice(format, currency)) return fail('Please choose a class type and currency.');

  let { now } = priceFor(course, format, currency);
  const list = now;
  let code: string | null = null;
  let referrer: number | null = null;
  if (str(b.code, 40)) {
    const applied = await applyCode(str(b.code, 40), course, format, currency, s.uid);
    if (!applied.ok) return fail(applied.error);
    ({ now } = applied);
    code = applied.code;
    referrer = applied.referrer;
  }
  const q = await db();
  const active = await q`SELECT 1 FROM mq_enrolments WHERE user_id = ${s.uid} AND course_slug = ${course.slug} AND status = 'active' LIMIT 1`;
  if (active.length) return json({ ok: true, already: true, url: `/courses/${course.slug}/learn` });

  const reference = `mq_${course.slug.slice(0, 12)}_${randomToken(9)}`;
  await q`INSERT INTO mq_enrolments (user_id, course_slug, format, currency, amount, reference, code, list_amount, referrer_user_id)
    VALUES (${s.uid}, ${course.slug}, ${format}, ${currency}, ${now}, ${reference}, ${code}, ${list}, ${referrer})`;

  if (paystackReady() && paystackCurrencies().includes(currency)) {
    try {
      const url = await initializePayment({
        email: s.email,
        amount: now,
        currency,
        reference,
        callbackUrl: `${SITE.url}/courses/${course.slug}/paid`,
        metadata: { course: course.slug, format, user_id: s.uid },
      });
      if (url) return json({ ok: true, url });
    } catch (e) {
      console.error('paystack init', safeError(e));
    }
  }

  // No online payment yet: hand over to WhatsApp with the reference so the team can confirm payment.
  const text = `Hello MarkIQ SI, I want to enrol in "${course.title}" (${format === 'physical' ? 'physical class, Abeokuta' : 'online'}) for ${money(now, currency)}${code ? ` (code ${code})` : ''}. My email: ${s.email}. Reference: ${reference}`;
  return json({ ok: true, manual: true, reference, url: `${SITE.whatsapp}?text=${encodeURIComponent(text)}` });
}
