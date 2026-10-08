import type { Metadata } from 'next';
import { FAQS } from '@/lib/content/faqs';
import { HelpBlock } from '@/components/HelpBlock';

export const metadata: Metadata = { title: 'FAQs', description: 'Answers about MarkIQ SI: accounts, Telegram market alerts, courses, the Bot Builder, the Market Scanner, data sources, safety and pricing.', alternates: { canonical: '/faqs' }, openGraph: { title: 'FAQs · MarkIQ SI', description: 'Answers about MarkIQ SI: accounts, Telegram market alerts, courses, the Bot Builder, the Market Scanner, data sources, safety and pricing.', url: '/faqs', images: ['/og.png'] } };

export default function FaqsPage() {
  const topics = Array.from(new Set(FAQS.map((f) => f.topic)));
  // Lets Google and AI tools read these questions and answers directly.
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />
      <section className="hero-band stack center" style={{ padding: '90px 16px 40px', textAlign: 'center' }}>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(40px, 6vw, 84px)' }}>Questions &amp; Answers</h1>
        <p className="lead rise d1" style={{ marginTop: 18 }}>Quick answers about MarkIQ SI. Still stuck? Contact us below.</p>
      </section>
      <section className="wrap stack" style={{ maxWidth: 1000, padding: '20px 16px 90px', gap: 36 }}>
        {topics.map((t) => (
          <div key={t} className="stack" style={{ gap: 12 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 28 }}>{t}</h2>
            {FAQS.filter((f) => f.topic === t).map((f) => (
              <details key={f.q} className="card" style={{ padding: 0 }}>
                <summary style={{ cursor: 'pointer', padding: '20px 24px', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20, listStyle: 'none' }}>{f.q}</summary>
                <p style={{ margin: 0, padding: '0 24px 22px', fontSize: 17, lineHeight: 1.6, color: 'var(--text)' }}>{f.a}</p>
              </details>
            ))}
          </div>
        ))}
      </section>
      <HelpBlock />
    </>
  );
}
