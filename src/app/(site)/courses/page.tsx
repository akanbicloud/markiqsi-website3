import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { ACADEMY, COURSES, LAUNCH, money, priceFor } from '@/lib/content/courses';
import { HelpBlock } from '@/components/HelpBlock';

const DESC = 'Trading courses from MarkIQ SI Academy, online or in class in Abeokuta: beginner to pro, fundamental analysis, trading automation, prop firm preparation and risk management. Prices in Naira and US dollars.';

export const metadata: Metadata = {
  title: 'Trading Courses: Online and in Abeokuta',
  description: DESC,
  alternates: { canonical: '/courses' },
  openGraph: { title: 'Trading Courses · MarkIQ SI Academy', description: DESC, url: '/courses', images: ['/og.png'] },
};

export default function CoursesPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: COURSES.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}/courses/${c.slug}`, name: c.title })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <section className="hero-band stack center" style={{ padding: '90px 16px 40px', textAlign: 'center' }}>
        <span className="eyebrow">MarkIQ SI Academy</span>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(36px, 5.5vw, 76px)' }}>Trading courses</h1>
        <p className="lead rise d1" style={{ marginTop: 18, maxWidth: 760 }}>
          Learn online or in class at {ACADEMY.addressLine}. See every course outline and price before you sign up.
        </p>
        {LAUNCH.discount > 0 && (
          <p className="chip" style={{ marginTop: 16 }}>
            Launch offer: {Math.round(LAUNCH.discount * 100)}% off{LAUNCH.endsOn ? ` until ${LAUNCH.endsOn}` : ''}
          </p>
        )}
      </section>
      <section className="wrap" style={{ maxWidth: 1150, padding: '20px 16px 80px' }}>
        <div className="grid g-2">
          {COURSES.map((c) => {
            const ngn = priceFor(c, 'online', 'NGN');
            const usd = priceFor(c, 'online', 'USD');
            const phy = priceFor(c, 'physical', 'NGN');
            return (
              <Link key={c.slug} href={`/courses/${c.slug}`} className="card stack card-link" style={{ gap: 10 }}>
                <span className="faint" style={{ fontSize: 14 }}>{c.level} · {c.weeks} weeks</span>
                <h2 className="h3" style={{ margin: 0 }}>{c.title}</h2>
                <p style={{ margin: 0, lineHeight: 1.55 }}>{c.short}</p>
                <div className="row" style={{ gap: '6px 18px', marginTop: 4, fontSize: 15 }}>
                  <span>Online <strong>{money(ngn.now, 'NGN')}</strong> / <strong>{money(usd.now, 'USD')}</strong></span>
                  <span>In class <strong>{money(phy.now, 'NGN')}</strong></span>
                </div>
                <span className="card-link-more" style={{ fontWeight: 600, color: 'var(--blue)' }}>See the outline »</span>
              </Link>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 28, fontSize: 15 }}>
          Courses teach skills and do not promise income or profit. Trading carries a high risk of loss.
        </p>
      </section>
      <HelpBlock />
    </>
  );
}
