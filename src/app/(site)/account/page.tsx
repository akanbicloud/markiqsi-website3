import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { AccountPanel } from '@/components/AccountPanel';
import { enrolmentsFor } from '@/lib/academy/enrol';
import { isAdminEmail } from '@/lib/academy/admin';
import { findCourse } from '@/lib/content/courses';
import { attendanceFor, certificatesFor, lessonKeys } from '@/lib/academy/progress';
import { referralCodeFor, referralPercent, referralStats } from '@/lib/academy/codes';
import { db } from '@/lib/db';
import { SITE } from '@/lib/site';
import { CopyText } from '@/components/academy/CopyText';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage() {
  const u = await currentUser().catch(() => null);
  if (!u) redirect('/login');
  const enrolments = await enrolmentsFor(u.id).catch(() => []);
  const mine = enrolments.filter((e) => e.status !== 'cancelled');
  const active = mine.some((e) => e.status === 'active');
  const [certs, attended, progressRows, refCode, refCount] = await Promise.all([
    certificatesFor(u.id).catch(() => []),
    attendanceFor(u.id).catch(() => ({} as Record<string, number>)),
    db().then((q) => q`SELECT course_slug, count(*)::int AS n FROM mq_progress WHERE user_id = ${u.id} GROUP BY course_slug`).catch(() => []) as Promise<{ course_slug: string; n: number }[]>,
    referralCodeFor({ id: u.id, name: u.name, email: u.email }).catch(() => null),
    referralStats(u.id).catch(() => 0),
  ]);
  const doneBy = Object.fromEntries(progressRows.map((r) => [r.course_slug, r.n]));
  const refLink = refCode ? `${SITE.url}/courses?ref=${refCode}` : '';
  return (
    <>
      <AccountPanel
        user={{ name: u.name || '', email: u.email, goal: u.goal || 'learn', level: u.level || 'new', markets: u.markets, telegram: !!u.telegram_chat_id, telegramUser: u.telegram_username || '' }}
        telegramReady={!!process.env.TELEGRAM_BOT_USERNAME}
      />
      <section className="wrap stack" style={{ maxWidth: 1000, padding: '0 16px 90px', gap: 14 }}>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 30, margin: 0 }}>My courses</h2>
        {mine.length ? (
          mine.map((e) => {
            const c = findCourse(e.course_slug);
            const total = c ? lessonKeys(c).length : 0;
            const pct = total ? Math.round(((doneBy[e.course_slug] || 0) / total) * 100) : 0;
            const cert = certs.find((x) => x.course_slug === (c?.slug || e.course_slug));
            return (
              <div key={e.id} className="card stack" style={{ gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <strong>{c?.title || e.course_slug}</strong>
                  {e.status === 'active' ? (
                    <Link className="btn" href={`/courses/${c?.slug || e.course_slug}/learn`}>{pct ? 'Continue' : 'Start course'}</Link>
                  ) : (
                    <span className="chip">Waiting for payment · ref {e.reference}</span>
                  )}
                </div>
                {e.status === 'active' && (
                  <>
                    <div style={{ height: 10, borderRadius: 99, background: 'var(--inset)', overflow: 'hidden' }} aria-hidden="true">
                      <div style={{ width: `${pct}%`, height: '100%', background: '#16A34A' }} />
                    </div>
                    <span className="muted" style={{ fontSize: 15 }}>
                      {pct}% of lessons done{e.format === 'physical' ? ` · ${attended[e.course_slug] || 0} classes attended` : ''}
                      {cert ? <> · 🎓 <Link href={`/certificates/${cert.id}`}>Your certificate</Link></> : ''}
                    </span>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            You have not enrolled in a course yet. <Link href="/courses">See the courses</Link>
          </p>
        )}
        {refCode && (
          <div className="card stack" style={{ gap: 8, background: 'var(--blue-soft)' }}>
            <strong style={{ fontSize: 19 }}>Invite a friend, they get {referralPercent()}% off</strong>
            <span>Your referral code: <strong>{refCode}</strong>{refCount ? ` · ${refCount} friend${refCount === 1 ? '' : 's'} enrolled with it` : ''}</span>
            <CopyText text={refLink} label="Copy your invite link" />
            {!active && <span className="faint" style={{ fontSize: 14 }}>Your friends use it when they enrol on any course.</span>}
          </div>
        )}
        {isAdminEmail(u.email) && (
          <div className="row" style={{ gap: 10 }}>
            <Link href="/account/enrolments" className="btn btn-outline">Enrolments and certificates</Link>
            <Link href="/account/codes" className="btn btn-outline">Discount codes</Link>
            <Link href="/account/attendance" className="btn btn-outline">Class register</Link>
          </div>
        )}
      </section>
    </>
  );
}
