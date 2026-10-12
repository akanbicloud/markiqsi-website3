import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE } from '@/lib/site';
import { ACADEMY, COURSES, LAUNCH, findCourse, money, priceFor } from '@/lib/content/courses';
import { enrolOptions } from '@/lib/academy/view';
import { EnrolBox } from '@/components/academy/EnrolBox';

export function generateStaticParams() {
  return COURSES.map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = findCourse((await params).slug);
  if (!c) return {};
  const url = `/courses/${c.slug}`;
  return { title: `${c.title} Course`, description: c.short, alternates: { canonical: url }, openGraph: { title: `${c.title} · MarkIQ SI Academy`, description: c.short, url, images: ['/og.png'] } };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const c = findCourse((await params).slug);
  if (!c) notFound();
  const ngn = priceFor(c, 'online', 'NGN');
  const usd = priceFor(c, 'online', 'USD');
  const phy = priceFor(c, 'physical', 'NGN');
  const url = `${SITE.url}/courses/${c.slug}`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: c.title,
        description: c.short,
        url,
        educationalLevel: c.level,
        teaches: c.outcomes,
        provider: { '@type': 'EducationalOrganization', name: ACADEMY.name, sameAs: SITE.url },
        offers: [
          { '@type': 'Offer', category: 'Paid', price: ngn.now, priceCurrency: 'NGN', url },
          { '@type': 'Offer', category: 'Paid', price: usd.now, priceCurrency: 'USD', url },
        ],
        hasCourseInstance: [
          { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: `P${c.weeks}W` },
          {
            '@type': 'CourseInstance',
            courseMode: 'Onsite',
            courseWorkload: `P${c.weeks}W`,
            location: { '@type': 'Place', name: ACADEMY.name, address: { '@type': 'PostalAddress', streetAddress: ACADEMY.street, addressLocality: `${ACADEMY.area}, ${ACADEMY.city}`, addressRegion: ACADEMY.region, addressCountry: ACADEMY.country } },
            offers: { '@type': 'Offer', price: phy.now, priceCurrency: 'NGN', category: 'Paid' },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'Courses', item: `${SITE.url}/courses` },
          { '@type': 'ListItem', position: 3, name: c.title, item: url },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <section className="hero-band stack center" style={{ padding: '80px 16px 36px', textAlign: 'center' }}>
        <Link href="/courses" className="eyebrow">MarkIQ SI Academy · Courses</Link>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(34px, 5vw, 68px)', maxWidth: 1000 }}>{c.title}</h1>
        <p className="lead rise d1" style={{ marginTop: 16, maxWidth: 760 }}>{c.short}</p>
        <p className="muted" style={{ marginTop: 10 }}>{c.level} · {c.weeks} weeks · online or in class in Abeokuta</p>
        <a className="btn" href="#enrol" style={{ marginTop: 18 }}>
          Prices and enrol: from {money(ngn.now, 'NGN')} / {money(usd.now, 'USD')} <span className="arr" aria-hidden="true">»</span>
        </a>
      </section>

      <div className="wrap" style={{ maxWidth: 1150, padding: '20px 16px 80px', display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 36, gridColumn: 'span 2' }}>
          <section className="stack" style={{ gap: 12 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 28 }}>What you will learn</h2>
            <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, fontSize: 18, lineHeight: 1.5 }}>
              {c.outcomes.map((o) => <li key={o}>{o}</li>)}
            </ul>
            <p style={{ margin: 0 }}><strong>Who it is for:</strong> {c.forWho}</p>
          </section>

          <section className="stack" style={{ gap: 14 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 28 }}>Course outline</h2>
            {c.outline.map((w) => (
              <div key={w.week} className="card stack" style={{ gap: 8 }}>
                <span className="faint" style={{ fontSize: 14 }}>{w.week}</span>
                <h3 className="h3" style={{ margin: 0 }}>{w.title}</h3>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4, lineHeight: 1.5 }}>
                  {w.lessons.map((l) => <li key={l}>{l}</li>)}
                </ul>
                {w.practice && <p className="muted" style={{ margin: 0 }}>Practice: {w.practice}</p>}
              </div>
            ))}
          </section>

          <section className="stack" style={{ gap: 10 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 24 }}>Tools you will use (free)</h2>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {c.tools.map((t) => <Link key={t.href} href={t.href} className="chip">{t.label}</Link>)}
            </div>
          </section>

          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            This course teaches skills. It does not promise income or profit, and trading carries a high risk of loss. MarkIQ SI provides education, not financial advice.
          </p>
        </div>

        <aside id="enrol" className="stack" style={{ gap: 12, position: 'sticky', top: 90, scrollMarginTop: 90 }}>
          <EnrolBox slug={c.slug} options={enrolOptions(c)} address={ACADEMY.addressLine} />
          {LAUNCH.discount > 0 && <p className="faint" style={{ margin: 0, fontSize: 14 }}>Launch offer: {Math.round(LAUNCH.discount * 100)}% off{LAUNCH.endsOn ? ` until ${LAUNCH.endsOn}` : ''}.</p>}
        </aside>
      </div>
    </>
  );
}
