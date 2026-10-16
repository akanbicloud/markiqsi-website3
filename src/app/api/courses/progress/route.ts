import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { findCourse } from '@/lib/content/courses';
import { hasAccess } from '@/lib/academy/enrol';
import { BUNDLES } from '@/lib/academy/view';
import { isAdminEmail } from '@/lib/academy/admin';
import { lessonKeys } from '@/lib/academy/progress';

/** Marks one lesson done or not done for the signed-in student. */
export async function POST(req: Request) {
  if (!hasDb()) return fail('Not available right now.', 503);
  const s = await getSession();
  if (!s) return fail('Please sign in.', 401);
  const b = await body(req);
  const c = findCourse(str(b.slug, 80));
  const lesson = str(b.lesson, 12);
  if (!c || !lessonKeys(c).includes(lesson)) return fail('Bad request.');
  if (!isAdminEmail(s.email) && !(await hasAccess(s.uid, c.slug, BUNDLES))) return fail('This course is not open on your account.', 403);
  const q = await db();
  if (b.done) await q`INSERT INTO mq_progress (user_id, course_slug, lesson) VALUES (${s.uid}, ${c.slug}, ${lesson}) ON CONFLICT DO NOTHING`;
  else await q`DELETE FROM mq_progress WHERE user_id = ${s.uid} AND course_slug = ${c.slug} AND lesson = ${lesson}`;
  const n = (await q`SELECT count(*)::int AS n FROM mq_progress WHERE user_id = ${s.uid} AND course_slug = ${c.slug}`) as { n: number }[];
  return json({ ok: true, done: n[0]?.n || 0, total: lessonKeys(c).length });
}
