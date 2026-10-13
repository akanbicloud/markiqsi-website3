import { OLD_SLUGS } from '../content/courses';
import { db } from '../db';

export type Enrolment = { id: number; course_slug: string; format: string; currency: string; amount: number; status: string; reference: string | null; created_at: string; paid_at: string | null };

export async function enrolmentsFor(userId: number): Promise<Enrolment[]> {
  const q = await db();
  return (await q`SELECT id, course_slug, format, currency, amount, status, reference, created_at, paid_at FROM mq_enrolments WHERE user_id = ${userId} ORDER BY created_at DESC`) as Enrolment[];
}

/** The Pro programme also unlocks every course it contains. Old (renamed) slugs count as the new ones. */
export async function hasAccess(userId: number, slug: string, bundles: Record<string, string[]>) {
  const rows = (await enrolmentsFor(userId)).filter((e) => e.status === 'active');
  const norm = (x: string) => OLD_SLUGS[x] || x;
  return rows.some((e) => norm(e.course_slug) === slug || (bundles[norm(e.course_slug)] || []).includes(slug));
}

/** Marks a payment reference as paid if the amount and currency match. Returns the course slug. */
export async function activateByReference(reference: string, paid: { amount: number; currency: string }) {
  const q = await db();
  const rows = (await q`SELECT id, amount, currency, status, course_slug FROM mq_enrolments WHERE reference = ${reference}`) as { id: number; amount: number; currency: string; status: string; course_slug: string }[];
  const e = rows[0];
  if (!e) return null;
  if (e.status === 'active') return e.course_slug;
  if (paid.currency !== e.currency || paid.amount + 0.001 < Number(e.amount)) return null;
  await q`UPDATE mq_enrolments SET status = 'active', paid_at = now() WHERE id = ${e.id}`;
  return e.course_slug;
}
