import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isAdminEmail } from '@/lib/academy/admin';

/** Saves the class register for one day: { day: 'YYYY-MM-DD', present: [enrolment ids], absent: [enrolment ids] }. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !isAdminEmail(s.email)) return fail('Not allowed.', 403);
  if (!hasDb()) return fail('Database not connected.', 503);
  const b = await body(req);
  const day = str(b.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('Pick the class date.');
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);
  const present = ids(b.present), absent = ids(b.absent);
  const q = await db();
  const all = [...present.map((id) => ({ id, p: true })), ...absent.map((id) => ({ id, p: false }))];
  if (all.length) {
    await q`INSERT INTO mq_attendance (enrolment_id, day, present, marked_by)
      SELECT x.id, ${day}::date, x.p, ${s.email} FROM jsonb_to_recordset(${JSON.stringify(all)}::jsonb) AS x(id bigint, p boolean)
      ON CONFLICT (enrolment_id, day) DO UPDATE SET present = EXCLUDED.present, marked_by = EXCLUDED.marked_by`;
  }
  return json({ ok: true, saved: all.length });
}
