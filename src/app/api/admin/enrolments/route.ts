import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isAdminEmail } from '@/lib/academy/admin';

/** Lets the owner confirm a payment made by bank transfer or WhatsApp, or cancel a request. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !isAdminEmail(s.email)) return fail('Not allowed.', 403);
  if (!hasDb()) return fail('Database not connected.', 503);
  const b = await body(req);
  const id = Number(b.id);
  const status = str(b.status, 12);
  if (!id || !['active', 'cancelled', 'pending'].includes(status)) return fail('Bad request.');
  const q = await db();
  await q`UPDATE mq_enrolments SET status = ${status}, paid_at = CASE WHEN ${status} = 'active' THEN COALESCE(paid_at, now()) ELSE paid_at END WHERE id = ${id}`;
  return json({ ok: true });
}
