import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, SITE } from '@/lib/site';
import { HelpBlock } from '@/components/HelpBlock';

const DESC = 'Who runs MarkIQ SI, where the Academy is, what we charge, what we never do, where our data comes from, and how to check us independently.';

export const metadata: Metadata = {
  title: 'Company and Verification: Is MarkIQ SI Legit?',
  description: DESC,
  alternates: { canonical: '/company' },
  openGraph: { title: 'Company and Verification · MarkIQ SI', description: DESC, url: '/company', images: ['/og.png'] },
};

const a = COMPANY.address;
const addressLine = `${a.street}, ${a.area}, ${a.city}, ${a.region}, ${a.country}`;

const NEVER = [
  'We never take deposits, manage your money or trade on your behalf.',
  'We never ask for your broker or MT5 trading password. Bots you build run inside your own MT5.',
  'We never sell signals or bots that promise profit, and we never promise income from a course.',
  'We never ask you to send money to a personal account through Instagram, Telegram or WhatsApp DMs.',
];

export default function CompanyPage() {
  const profiles = [
    { label: 'Instagram', url: SITE.instagram },
    { label: 'X (Twitter)', url: SITE.x },
    { label: 'Telegram channel', url: SITE.telegram },
    { label: 'Facebook', url: SITE.facebook },
    { label: 'LinkedIn', url: COMPANY.linkedinPage },
    { label: 'Google Business Profile', url: COMPANY.googleBusinessProfile },
    { label: `${COMPANY.founder.name} on LinkedIn`, url: COMPANY.founder.linkedin },
  ].filter((p) => p.url);
  const faq = [
    { q: 'Is MarkIQ SI legit?', a: `MarkIQ SI is a trading education and market information platform founded by ${COMPANY.founder.name}, with a physical academy at ${addressLine}. You can call or visit us, see every course price before paying, and use the tools free. We do not take deposits, manage money, sell signals or promise profit.` },
    { q: 'Who owns MarkIQ SI?', a: `MarkIQ SI was founded and is run by ${COMPANY.founder.name}. ${COMPANY.founder.bio}` },
    { q: 'Does MarkIQ SI manage money or offer investment returns?', a: 'No. MarkIQ SI never takes deposits, manages money or trades for anyone. Anyone offering returns in the name of MarkIQ SI is not us.' },
    { q: 'How much does MarkIQ SI cost?', a: 'The tools and market information are free to use with fair daily limits. Academy courses are paid, and every price is listed in Naira and US dollars on markiqsi.com/courses.' },
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'AboutPage', '@id': `${SITE.url}/company#page`, url: `${SITE.url}/company`, name: 'Company and Verification', about: { '@id': `${SITE.url}/#org` } },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="display" style={{ fontWeight: 700, fontSize: 28, margin: 0 }}>{children}</h2>;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <section className="hero-band stack center" style={{ padding: '90px 16px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Company and verification</span>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(34px, 5vw, 68px)', maxWidth: 980 }}>Who we are, and how to check us</h1>
        <p className="lead rise d1" style={{ marginTop: 16, maxWidth: 760 }}>Before you trust any trading business, you should be able to see who runs it, where it is, what it charges and what it will never do. Here is ours.</p>
      </section>

      <div className="wrap stack" style={{ maxWidth: 1000, padding: '20px 16px 80px', gap: 40 }}>
        <section className="grid g-2">
          <div className="card stack" style={{ gap: 8 }}>
            <H>Who runs MarkIQ SI</H>
            <strong style={{ fontSize: 19 }}>{COMPANY.founder.name}</strong>
            <span className="muted">{COMPANY.founder.role}</span>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{COMPANY.founder.bio}</p>
            {COMPANY.founder.linkedin && <a href={COMPANY.founder.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn profile</a>}
            <Link href="/about#founder">Read the founder&apos;s story</Link>
          </div>
          <div className="card stack" style={{ gap: 8 }}>
            <H>Where we are</H>
            <p style={{ margin: 0, lineHeight: 1.6 }}>MarkIQ SI Academy and trading floor:<br /><strong>{addressLine}</strong></p>
            <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
            <p style={{ margin: 0, lineHeight: 1.6 }}>Phone and WhatsApp: <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneIntl}</a><br />Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
            <p className="muted" style={{ margin: 0 }}>Physical classes started on 10 October 2026. You are welcome to visit; message us first so someone is there.</p>
          </div>
        </section>

        {(COMPANY.legalName || COMPANY.cacNumber) && (
          <section className="card stack" style={{ gap: 8 }}>
            <H>Registration</H>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Registered in Nigeria with the Corporate Affairs Commission{COMPANY.legalName ? <> as <strong>{COMPANY.legalName}</strong></> : null}
              {COMPANY.cacNumber ? <>, number <strong>{COMPANY.cacNumber}</strong></> : null}
              {COMPANY.registeredOn ? <>, on {new Date(COMPANY.registeredOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</> : null}.
            </p>
            <p className="muted" style={{ margin: 0 }}>You can check this yourself on the CAC public search at <a href="https://search.cac.gov.ng" target="_blank" rel="noopener noreferrer">search.cac.gov.ng</a>.</p>
          </section>
        )}

        <section className="stack" style={{ gap: 12 }}>
          <H>What we do, and what we charge</H>
          <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, lineHeight: 1.6, fontSize: 18 }}>
            <li><strong>Market information:</strong> official economic data, interest rates and news explained in plain words. Free.</li>
            <li><strong>Tools:</strong> Bot Builder, Indicator Builder, Market Scanner, Chart Analysis, Risk Calculator, Prop Challenge Tracker and Trading Journal. Free with fair daily limits, no account needed. Tools marked &quot;beta&quot; are new and still being improved.</li>
            <li><strong>Academy:</strong> paid courses online and in class in Abeokuta. <Link href="/courses">Every outline and price</Link> is public before you sign up.</li>
          </ul>
        </section>

        <section className="card stack" style={{ gap: 10, borderColor: 'var(--ink)' }}>
          <H>What we will never do</H>
          <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, lineHeight: 1.6, fontSize: 18 }}>{NEVER.map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="muted" style={{ margin: 0 }}>If someone uses our name to ask for money or promise returns, it is not us. Please tell us on {SITE.phoneIntl}.</p>
        </section>

        <section className="stack" style={{ gap: 12 }}>
          <H>Where our numbers come from</H>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 18 }}>Economic figures come from official sources such as the US Bureau of Labor Statistics and central banks, with the date and source shown. Prices for charts, backtests and the scanner come from a commercial market data provider (Twelve Data). AI is used to explain the data, never to invent numbers. Market data can be delayed or revised, and nothing on MarkIQ SI is financial advice.</p>
        </section>

        <section className="stack" style={{ gap: 12 }}>
          <H>How our tools are tested</H>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 18 }}>Every backtest lists its assumptions on the report: entry at the next candle, spread charged on every trade, and the stop counted first when the stop and target are hit in the same candle. Reports also show how a strategy did on the last 30% of the history it was not built on. We tell every user to test on a demo account for 2 to 4 weeks before risking money.</p>
        </section>

        {COMPANY.press.length > 0 && (
          <section className="stack" style={{ gap: 12 }}>
            <H>In the press</H>
            <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8 }}>{COMPANY.press.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a> · {p.outlet}, {new Date(p.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}{p.author ? `, by ${p.author}` : ''}</li>)}</ul>
          </section>
        )}

        <section className="stack" style={{ gap: 12 }}>
          <H>Check us independently</H>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 18 }}>These are our only official accounts. Call us, visit the Academy, or message us on any of them:</p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {profiles.map((p) => <a key={p.label} href={p.url} className="chip" target="_blank" rel="noopener noreferrer me">{p.label}</a>)}
          </div>
        </section>

        <section className="stack" style={{ gap: 12 }}>
          <H>Questions people ask</H>
          {faq.map((f) => (
            <details key={f.q} className="card" style={{ padding: 0 }}>
              <summary style={{ cursor: 'pointer', padding: '18px 22px', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 19, listStyle: 'none' }}>{f.q}</summary>
              <p style={{ margin: 0, padding: '0 22px 20px', fontSize: 17, lineHeight: 1.6 }}>{f.a}</p>
            </details>
          ))}
        </section>
      </div>
      <HelpBlock />
    </>
  );
}
