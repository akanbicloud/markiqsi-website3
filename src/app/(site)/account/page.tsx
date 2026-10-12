import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { AccountPanel } from '@/components/AccountPanel';
import { enrolmentsFor } from '@/lib/academy/enrol';
import { isAdminEmail } from '@/lib/academy/admin';
import { findCourse } from '@/lib/content/courses';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage() {
  const u = await currentUser().catch(() => null);
  if (!u) redirect('/login');
  const enrolments = await enrolmentsFor(u.id).catch(() => []);
  const mine = enrolments.filter((e) => e.status !== 'cancelled');
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
            return (
              <div key={e.id} className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>{c?.title || e.course_slug}</strong>
                {e.status === 'active' ? (
                  <Link className="btn" href={`/courses/${e.course_slug}/learn`}>Open course</Link>
                ) : (
                  <span className="chip">Waiting for payment · ref {e.reference}</span>
                )}
              </div>
            );
          })
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            You have not enrolled in a course yet. <Link href="/courses">See the courses</Link>
          </p>
        )}
        {isAdminEmail(u.email) && (
          <Link href="/account/enrolments" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Manage enrolments (admin)</Link>
        )}
      </section>
    </>
  );
}
