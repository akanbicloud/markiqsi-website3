import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { isAdminEmail } from '@/lib/academy/admin';
import { db } from '@/lib/db';
import { COURSES, findCourse, money } from '@/lib/content/courses';
import { AdminCodes } from '@/components/academy/AdminCodes';

export const metadata: Metadata = { title: 'Discount codes', robots: { index: false } };

export default async function CodesAdmin() {
  const u = await currentUser().catch(() => null);
  if (!u || !isAdminEmail(u.email)) redirect('/account');
  const q = await db();
  const rows = (await q`SELECT c.*, to_char(c.expires_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS ends, u.email AS owner_email,
      (SELECT count(*)::int FROM mq_enrolments e WHERE e.code = c.code AND e.status = 'active') AS paid
    FROM mq_codes c LEFT JOIN mq_users u ON u.id = c.owner_user_id
    ORDER BY (c.kind = 'discount') DESC, c.created_at DESC LIMIT 400`) as { code: string; kind: string; percent: number | null; amount_ngn: number | null; amount_usd: number | null; courses: string[] | null; used: number; max_uses: number | null; ends: string | null; active: boolean; owner_email: string | null; note: string | null; paid: number }[];
  const codes = rows.filter((r) => r.kind === 'discount' || r.paid > 0).map((r) => ({
    code: r.code, kind: r.kind,
    deal: r.percent ? `${r.percent}% off` : [r.amount_ngn ? `${money(r.amount_ngn, 'NGN')} off` : '', r.amount_usd ? `${money(r.amount_usd, 'USD')} off` : ''].filter(Boolean).join(' / '),
    courses: r.courses?.length ? r.courses.map((s) => findCourse(s)?.title || s).join(', ') : 'all courses',
    used: Number(r.used), max: r.max_uses, expires: r.ends || '', active: r.active, owner: r.owner_email || '', note: r.note || '',
  }));
  return (
    <section className="wrap stack" style={{ maxWidth: 1000, padding: '60px 16px 100px', gap: 20 }}>
      <h1 className="display" style={{ fontWeight: 700, fontSize: 40, margin: 0 }}>Discount and referral codes</h1>
      <p className="muted" style={{ margin: 0 }}>Discount codes are for promotions. Every student also gets a personal referral code on their account page; referral codes appear here once someone has paid with one. A code is counted as used only when the payment is confirmed.</p>
      <AdminCodes codes={codes} courses={COURSES.map((c) => ({ slug: c.slug, title: c.title }))} />
    </section>
  );
}
