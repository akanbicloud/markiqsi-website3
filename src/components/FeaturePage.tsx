import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { FEATURE_PAGES, type FeaturePageContent } from '@/lib/content/features';
import { HelpBlock } from '@/components/HelpBlock';

export function featureMetadata(slug: string): Metadata {
  const p = FEATURE_PAGES[slug];
  const url = `/${p.slug}`;
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: url },
    openGraph: { title: `${p.title} · MarkIQ SI`, description: p.description, url, images: ['/og.png'] },
  };
}

function ctaHref(href: string) {
  return href === 'whatsapp' ? SITE.whatsapp : href;
}

function buildLd(p: FeaturePageContent) {
  const url = `${SITE.url}/${p.slug}`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: p.eyebrow, item: url },
      ],
    },
    { '@type': 'FAQPage', mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  if (p.schema.kind === 'software') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: p.schema.name,
      applicationCategory: p.schema.category,
      operatingSystem: 'Web',
      description: p.description,
      url,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${SITE.url}/#org` },
    });
  } else if (p.schema.kind === 'academy') {
    graph.push({
      '@type': 'EducationalOrganization',
      '@id': `${SITE.url}/academy#academy`,
      name: 'MarkIQ SI Academy',
      parentOrganization: { '@id': `${SITE.url}/#org` },
      url,
      telephone: SITE.phoneIntl,
      email: SITE.email,
      areaServed: 'Nigeria',
      address: { '@type': 'PostalAddress', streetAddress: '24 Majek Kembo Plaza, beside Chicken Republic, Oke-Ilewo', addressLocality: 'Abeokuta', addressRegion: 'Ogun State', addressCountry: 'NG' },
    });
  } else {
    graph.push({ '@type': 'WebPage', name: p.title, description: p.description, url, isPartOf: { '@id': `${SITE.url}/#website` } });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function FeaturePage({ slug }: { slug: string }) {
  const p = FEATURE_PAGES[slug];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLd(p)).replace(/</g, '\\u003c') }} />
      <section className="hero-band stack center" style={{ padding: '90px 16px 50px', textAlign: 'center' }}>
        <span className="eyebrow">{p.eyebrow}</span>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(34px, 5.5vw, 72px)', maxWidth: 1000 }}>{p.h1}</h1>
        <p className="lead rise d1" style={{ marginTop: 18, maxWidth: 780 }}>{p.lead}</p>
        <div className="row center" style={{ gap: 12, marginTop: 24 }}>
          <Link className="btn btn-lg" href={ctaHref(p.cta.href)}>{p.cta.label}</Link>
          {p.secondaryCta && <Link className="btn btn-lg btn-outline" href={ctaHref(p.secondaryCta.href)}>{p.secondaryCta.label}</Link>}
        </div>
      </section>

      <div className="wrap stack" style={{ maxWidth: 1100, padding: '20px 16px 70px', gap: 48 }}>
        {p.sections.map((s) => (
          <section key={s.heading} className="stack" style={{ gap: 16 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 30 }}>{s.heading}</h2>
            {s.intro && <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>{s.intro}</p>}
            <div className="grid g-2">
              {s.items.map((i) => (
                <div key={i.title} className="card stack" style={{ gap: 8 }}>
                  <h3 className="h3">{i.title}</h3>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{i.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {p.steps && (
          <section className="stack" style={{ gap: 14 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 30 }}>{p.stepsHeading}</h2>
            <ol style={{ margin: 0, paddingLeft: 24, display: 'grid', gap: 10, fontSize: 18, lineHeight: 1.55 }}>
              {p.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>
        )}

        <p className="card muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.6 }}>{p.note}</p>

        <section className="stack" style={{ gap: 14 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 30 }}>Questions</h2>
          {p.faqs.map((f) => (
            <details key={f.q} className="card" style={{ padding: 0 }}>
              <summary style={{ cursor: 'pointer', padding: '18px 22px', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 19, listStyle: 'none' }}>{f.q}</summary>
              <p style={{ margin: 0, padding: '0 22px 20px', fontSize: 17, lineHeight: 1.6 }}>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="stack" style={{ gap: 14 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 24 }}>Explore more</h2>
          <div className="grid g-3">
            {p.related.map((r) => (
              <Link key={r.href} href={r.href} className="card stack card-link" style={{ gap: 6 }}>
                <strong>{r.label}</strong>
                <span className="muted">{r.text}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <HelpBlock />
    </>
  );
}
