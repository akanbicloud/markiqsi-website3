import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SITE } from '@/lib/site';
import { ACADEMY, findCourse } from '@/lib/content/courses';
import { currentUser } from '@/lib/users';
import { hasAccess } from '@/lib/academy/enrol';
import { BUNDLES } from '@/lib/academy/view';
import { isAdminEmail } from '@/lib/academy/admin';
import { attendanceFor, certificatesFor, progressFor } from '@/lib/academy/progress';
import { LessonChecklist } from '@/components/academy/LessonChecklist';

export const metadata: Metadata = { title: 'Your course', robots: { index: false } };

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = findCourse((await params).slug);
  if (!c) notFound();
  const u = await currentUser().catch(() => null);
  if (!u) redirect('/login');
  const ok = isAdminEmail(u.email) || (await hasAccess(u.id, c.slug, BUNDLES).catch(() => false));
  if (!ok) redirect(`/courses/${c.slug}`);
  const [done, certs, attended] = await Promise.all([
    progressFor(u.id, c.slug).catch(() => []),
    certificatesFor(u.id).catch(() => []),
    attendanceFor(u.id).catch(() => ({} as Record<string, number>)),
  ]);
  const cert = certs.find((x) => x.course_slug === c.slug);
  return (
    <section className="wrap stack" style={{ maxWidth: 1000, padding: '70px 16px 100px', gap: 28 }}>
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Your course</span>
        <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(32px, 4.5vw, 56px)', margin: 0 }}>{c.title}</h1>
        <p className="lead" style={{ margin: 0 }}>Welcome, {u.name || 'trader'}. Your mentor will share class times and live links on WhatsApp.</p>
      </div>
      <div className="note note-info">
        Physical classes: {ACADEMY.addressLine}. Questions: <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp {SITE.phoneIntl}</a>
      </div>
      {cert && (
        <div className="note note-ok">
          🎓 Your certificate is ready: <Link href={`/certificates/${cert.id}`}>view, print or share it</Link> (ID {cert.id}).
        </div>
      )}
      {attended[c.slug] ? <p className="muted" style={{ margin: 0 }}>Physical classes attended: <strong>{attended[c.slug]}</strong></p> : null}
      <LessonChecklist slug={c.slug} outline={c.outline} initialDone={done} />
      <div className="stack" style={{ gap: 10 }}>
        <h2 className="h3">Your tools</h2>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {c.tools.map((t) => <Link key={t.href} href={t.href} className="chip">{t.label}</Link>)}
        </div>
      </div>
    </section>
  );
}
