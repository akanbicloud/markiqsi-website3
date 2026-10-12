import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findCourse } from '@/lib/content/courses';
import { paystackReady, verifyPayment } from '@/lib/academy/paystack';
import { activateByReference } from '@/lib/academy/enrol';
import { hasDb } from '@/lib/db';
import { safeError } from '@/lib/http';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

/** Paystack sends the buyer back here with ?reference=... We confirm with Paystack before opening the course. */
export default async function PaidPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const c = findCourse((await params).slug);
  if (!c) notFound();
  const sp = await searchParams;
  const ref = (sp.reference || sp.trxref || '').slice(0, 100);
  let ok = false;
  if (ref && paystackReady() && hasDb()) {
    try {
      const v = await verifyPayment(ref);
      ok = v.status === 'success' && !!(await activateByReference(ref, v));
    } catch (e) {
      console.error('paystack verify', safeError(e));
    }
  }
  return (
    <section className="wrap" style={{ padding: '80px 16px 140px', maxWidth: 760 }}>
      <div className="card-lg stack" style={{ gap: 18 }}>
        <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(30px, 4vw, 48px)', margin: 0 }}>{ok ? 'Payment confirmed' : 'We are checking your payment'}</h1>
        <p style={{ margin: 0, fontSize: 18 }}>
          {ok ? `You are enrolled in ${c.title}.` : 'If you paid, your course will open within a few minutes. If it does not, message us on WhatsApp with your reference.'}
        </p>
        {ref && <p className="faint" style={{ margin: 0 }}>Reference: {ref}</p>}
        <Link className="btn" href={ok ? `/courses/${c.slug}/learn` : '/account'} style={{ alignSelf: 'flex-start' }}>
          {ok ? 'Open your course' : 'Go to my account'} <span className="arr" aria-hidden="true">»</span>
        </Link>
      </div>
    </section>
  );
}
