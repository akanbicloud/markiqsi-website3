import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { isAdminEmail } from '@/lib/academy/admin';
import { db } from '@/lib/db';
import { COURSES, findCourse } from '@/lib/content/courses';
import { AdminAttendance } from '@/components/academy/AdminAttendance';

export const metadata: Metadata = { title: 'Class register', robots: { index: false } };

export default async function AttendanceAdmin({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const u = await currentUser().catch(() => null);
  if (!u || !isAdminEmail(u.email)) redirect('/account');
  const sp = await searchParams;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day || '') ? sp.day! : today;
  const q = await db();
  const rows = (await q`SELECT e.id, e.course_slug, u.name, u.email,
      (SELECT count(*)::int FROM mq_attendance a WHERE a.enrolment_id = e.id AND a.present) AS attended,
      (SELECT a.present FROM mq_attendance a WHERE a.enrolment_id = e.id AND a.day = ${day}::date) AS today
    FROM mq_enrolments e JOIN mq_users u ON u.id = e.user_id
    WHERE e.status = 'active' AND e.format = 'physical' ORDER BY u.name NULLS LAST, u.email`) as { id: number; course_slug: string; name: string | null; email: string; attended: number; today: boolean | null }[];
  const students = rows.map((r) => ({ enrolment: Number(r.id), name: r.name || '', email: r.email, course: findCourse(r.course_slug)?.title || r.course_slug, slug: findCourse(r.course_slug)?.slug || r.course_slug, attended: r.attended, today: r.today }));
  const used = COURSES.filter((c) => students.some((s) => s.slug === c.slug));
  return (
    <section className="wrap stack" style={{ maxWidth: 1000, padding: '60px 16px 100px', gap: 20 }}>
      <h1 className="display" style={{ fontWeight: 700, fontSize: 40, margin: 0 }}>Class register</h1>
      <p className="muted" style={{ margin: 0 }}>Tick who came to the physical class on the chosen day and save. Students see how many classes they have attended on their account page.</p>
      <AdminAttendance students={students} day={day} courses={(used.length ? used : COURSES).map((c) => ({ slug: c.slug, title: c.title }))} />
    </section>
  );
}
