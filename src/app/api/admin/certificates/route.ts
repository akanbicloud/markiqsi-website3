import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { isAdminEmail } from '@/lib/academy/admin';
import { newCertificateId } from '@/lib/academy/progress';

/** Issue (or revoke) a certificate for a paid enrolment. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || !isAdminEmail(s.email)) return fail('Not allowed.', 403);
  if (!hasDb()) return fail('Database not connected.', 503);
  const b = await body(req);
  const q = await db();
  if (b.action === 'revoke') {
    await q`UPDATE mq_certificates SET revoked = TRUE WHERE id = ${str(b.id, 20)}`;
    return json({ ok: true });
  }
  const id = Number(b.enrolment_id);
  const rows = (await q`SELECT e.user_id, e.course_slug, e.format, e.status, u.name, u.email FROM mq_enrolments e JOIN mq_users u ON u.id = e.user_id WHERE e.id = ${id}`) as { user_id: number; course_slug: string; format: string; status: string; name: string | null; email: string }[];
  const e = rows[0];
  if (!e) return fail('Enrolment not found.', 404);
  if (e.status !== 'active') return fail('Only paid enrolments can get a certificate.');
  const name = str(b.name, 80) || e.name || '';
  if (name.length < 2) return fail('Add the student’s full name for the certificate.');
  for (let i = 0; i < 5; i++) {
    const cid = newCertificateId();
    const ins = (await q`INSERT INTO mq_certificates (id, user_id, course_slug, name, format, issued_by)
      VALUES (${cid}, ${e.user_id}, ${e.course_slug}, ${name}, ${e.format}, ${s.email})
      ON CONFLICT (user_id, course_slug) DO UPDATE SET name = EXCLUDED.name, revoked = FALSE
      RETURNING id`) as { id: string }[];
    if (ins[0]) return json({ ok: true, id: ins[0].id });
  }
  return fail('Could not issue the certificate. Please try again.', 500);
}
