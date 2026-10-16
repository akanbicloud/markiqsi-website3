import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findCourse, ACADEMY } from '@/lib/content/courses';
import { certificateById } from '@/lib/academy/progress';
import { COMPANY, SITE } from '@/lib/site';
import { PrintButton } from '@/components/academy/PrintButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Certificate ${id}`, robots: { index: false } };
}

/** Public certificate page: anyone with the ID can check it is genuine. */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await certificateById(id.toUpperCase()).catch(() => null);
  if (!cert) notFound();
  const course = findCourse(cert.course_slug);
  const issued = new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
  return (
    <section className="wrap stack" style={{ maxWidth: 1000, padding: '50px 16px 90px', gap: 20 }}>
      <style>{`@media print { header, footer, .no-print { display: none !important } body { background: #fff } .cert { box-shadow: none !important; margin: 0 } }`}</style>
      {cert.revoked ? (
        <div className="note note-bad"><strong>This certificate has been withdrawn</strong> and is no longer valid.</div>
      ) : (
        <div className="note note-ok no-print"><strong>✓ Verified.</strong> This certificate was issued by {ACADEMY.name}. Certificate ID {cert.id}.</div>
      )}
      <div className="cert stack center" style={{ background: '#FFFDF7', border: '10px double #0B1A36', borderRadius: 18, padding: 'clamp(28px, 6vw, 70px)', gap: 18, textAlign: 'center', boxShadow: '0 10px 40px rgba(11,26,54,.12)', opacity: cert.revoked ? 0.4 : 1 }}>
        <span style={{ letterSpacing: '0.3em', fontWeight: 700, color: '#1A5FD0', fontSize: 14 }}>MARKIQ SI ACADEMY</span>
        <h1 className="display" style={{ margin: 0, fontSize: 'clamp(30px, 5vw, 54px)', fontWeight: 700 }}>Certificate of Completion</h1>
        <span className="muted" style={{ fontSize: 18 }}>This certifies that</span>
        <span className="display" style={{ fontSize: 'clamp(28px, 4.5vw, 46px)', fontWeight: 700, borderBottom: '2px solid #0B1A36', padding: '0 24px 6px' }}>{cert.name}</span>
        <span className="muted" style={{ fontSize: 18 }}>has successfully completed</span>
        <strong style={{ fontSize: 'clamp(20px, 3vw, 28px)' }}>{course?.title || cert.course_slug}</strong>
        <span className="muted">{course ? `${course.weeks} weeks` : ''}{cert.format ? ` · ${cert.format === 'physical' ? `physical class, ${ACADEMY.city}` : 'online class'}` : ''}</span>
        <div className="row" style={{ justifyContent: 'space-between', width: '100%', marginTop: 24, gap: 20, fontSize: 15 }}>
          <div className="stack" style={{ gap: 2, textAlign: 'left' }}>
            <strong>{issued}</strong>
            <span className="faint">Date issued</span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{COMPANY.founder.name}</strong>
            <span className="faint">Founder, MarkIQ SI</span>
          </div>
          <div className="stack" style={{ gap: 2, textAlign: 'right' }}>
            <strong>{cert.id}</strong>
            <span className="faint">Verify at {SITE.url.replace('https://', '')}/certificates/{cert.id}</span>
          </div>
        </div>
      </div>
      {!cert.revoked && <PrintButton />}
    </section>
  );
}
