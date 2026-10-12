import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { isAdminEmail } from '@/lib/academy/admin';
import { db } from '@/lib/db';
import { findCourse, money, type Currency } from '@/lib/content/courses';
import { AdminEnrolments } from '@/components/academy/AdminEnrolments';

export const metadata: Metadata = { title: 'Enrolments', robots: { index: false } };

export default async function EnrolmentsAdmin() {
  const u = await currentUser().catch(() => null);
  if (!u || !isAdminEmail(u.email)) redirect('/account');
  const q = await db();
  const rows = (await q`SELECT e.id, u.email, e.course_slug, e.format, e.currency, e.amount, e.status, e.reference, to_char(e.created_at, 'YYYY-MM-DD HH24:MI') AS created
    FROM mq_enrolments e JOIN mq_users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 300`) as { id: number; email: string; course_slug: string; format: string; currency: Currency; amount: number; status: string; reference: string | null; created: string }[];
  return (
    <section className="wrap stack" style={{ maxWidth: 1000, padding: '60px 16px 100px', gap: 20 }}>
      <h1 className="display" style={{ fontWeight: 700, fontSize: 40, margin: 0 }}>Enrolments</h1>
      <p className="muted" style={{ margin: 0 }}>When someone pays by transfer, find their reference here and press Mark paid. Paystack payments open automatically.</p>
      <AdminEnrolments
        rows={rows.map((r) => ({ id: Number(r.id), email: r.email, course: findCourse(r.course_slug)?.title || r.course_slug, format: r.format, amount: money(Number(r.amount), r.currency), status: r.status, reference: r.reference, created: r.created }))}
      />
    </section>
  );
}
