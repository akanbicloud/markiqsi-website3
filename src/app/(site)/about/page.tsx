import type { Metadata } from 'next';
import Link from 'next/link';
import { Founder } from '@/components/Founder';
import { HelpBlock } from '@/components/HelpBlock';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'About', description: 'MarkIQ SI is a market intelligence platform and trading academy.' };

const PROBLEMS = [
  { n: '01', title: 'The price moves before anyone explains why.', text: 'Inflation numbers, rate decisions and world events move markets in seconds. Most traders find out what happened only after the move is over.', answer: 'alerts before and after every major release, with the official numbers and a plain explanation.' },
  { n: '02', title: 'Too much noise, too few facts.', text: 'Signal groups and social media are full of guesses, hype and promises of easy profit, with no sources and no accountability.', answer: 'official data only, every source shown, and no promises of profit, ever.' },
  { n: '03', title: 'Automation feels out of reach.', text: 'Many traders have a strategy they believe in, but turning it into a tested trading bot usually needs years of coding.', answer: 'describe your strategy in plain words and we help you build, test and run it on your own MT5.' },
];

const PILLARS = [
  { n: '01', title: 'Market Intelligence', text: 'Know what is moving the market, and why, as it happens.', items: ['Telegram alerts before and after high-impact releases', 'Weekly events across seven major economies', 'Central bank rates, news and geopolitics in plain words', 'Ask MarkIQ: the fundamentals and history behind any asset'], cta: 'See Markets', href: '/markets', bg: '#1A5FD0', fg: '#FFFFFF' },
  { n: '02', title: 'Academy', text: 'Structured learning, from your very first lesson to advanced strategy.', items: ['Risk management and trading psychology', 'Technical analysis and market structure', 'Fundamental analysis, central banks and geopolitics', 'Physical classes and live virtual sessions'], cta: 'Start Learning', href: '/#learn', bg: '#3DDC97', fg: '#0B1A36' },
  { n: '03', title: 'Trading Tools', text: 'Professional tools to plan, check and review every trade.', items: ['Risk Calculator and Prop Challenge Tracker', 'Market Scanner for supply and demand, ICT and SMC setups', 'Charts with years of history', 'A private Trading Journal'], cta: 'Open Tools', href: '/tools', bg: '#FFB547', fg: '#0B1A36' },
  { n: '04', title: 'Build & Automate', text: 'Turn your strategy into technology you own.', items: ['Describe your strategy in plain words', 'Get a bot in MQL5 or Pine Script', 'Backtest it and run it on demo first', 'Deploy it on your own MT5, and publish or sell it'], cta: 'Start Building', href: '/tools?tool=bot', bg: '#FF7A45', fg: '#0B1A36' },
];

const FLOW = [
  { n: '1', title: 'Collect', text: 'We take economic data straight from official sources such as the US Bureau of Labor Statistics, the Federal Reserve, the ECB and the Bank of England.' },
  { n: '2', title: 'Verify', text: 'Our code checks every number against what was expected. If a source is late, we say "awaiting official data" instead of guessing.' },
  { n: '3', title: 'Explain', text: 'Each result is turned into a short, plain explanation: what happened, how big the surprise was and why it matters.' },
  { n: '4', title: 'Deliver', text: 'Alerts reach you on Telegram and the website before and after each release, in your time zone.' },
  { n: '5', title: 'Learn from history', text: 'We show how markets reacted to the same events in past years, as context, never as a promise.' },
];

const VALUES = [
  { title: 'Facts before opinions', text: 'We use official data and show the source of every number. When we do not have the facts, we say so.' },
  { title: 'Education, not signals', text: 'We help you understand the market and make your own decisions. We never tell you what to buy or sell.' },
  { title: 'No guaranteed profits', text: 'Trading carries real risk. We will never promise returns, and we put risk management first in everything we teach.' },
  { title: 'Your account, your control', text: 'Your trading bot runs on your own MT5. We never ask for or store your trading password.' },
  { title: 'Test before you trust', text: 'Every strategy should be backtested and run on a demo account before real money is involved.' },
  { title: 'Built to last', text: 'We release features only when they work properly with real data, and we keep improving them.' },
];

const AUDIENCE = [
  { title: 'Beginners', text: 'Start from zero with clear lessons, simple tools and alerts explained in plain words.', bg: 'var(--surface)', fg: 'var(--ink)' },
  { title: 'Active traders', text: 'Stay ahead of every major release with official data, news, rates and the Market Scanner.', bg: 'var(--blue-soft)', fg: 'var(--ink)' },
  { title: 'Prop firm traders', text: 'Track your challenge rules, protect your drawdown and size every trade with discipline.', bg: '#FFE9C7', fg: '#0B1A36' },
  { title: 'Builders', text: 'Turn your strategy into a bot, test it properly, run it on MT5 and share or sell your work.', bg: '#0B1A36', fg: '#FFFFFF' },
];

const ROAD = [
  { stage: 'Available at launch', on: true, items: ['Telegram market alerts from official data', 'Markets: events, rates and news', 'Risk Calculator and Prop Challenge Tracker', 'Charts and the Trading Journal'] },
  { stage: 'In beta', on: false, items: ['Market Scanner with Telegram alerts', 'Bot Builder with backtesting', 'Ask MarkIQ', 'Academy courses and classes'] },
  { stage: 'Coming next', on: false, items: ['A community for MarkIQ SI traders', 'A marketplace to publish and sell bots and indicators', 'Weekly research and market outlooks', 'Certificates for completed courses'] },
];

function Head({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text?: string; light?: boolean }) {
  return (
    <div className={`stack ${light ? 'on-navy' : ''}`} style={{ gap: 12, maxWidth: 860 }}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="h2">{title}</h2>
      {text && <p style={{ margin: 0, fontSize: 19, color: light ? '#B9C9E6' : 'var(--muted)' }}>{text}</p>}
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <section className="hero-band stack center" style={{ padding: '110px 16px 70px', textAlign: 'center' }}>
        <div className="stack center" style={{ maxWidth: 1120, gap: 26 }}>
          <span className="pill-tag rise" style={{ alignSelf: 'center' }}>About MarkIQ SI</span>
          <h1 className="h1 rise" style={{ fontSize: 'clamp(40px, 6.2vw, 90px)' }}>
            Understand the Market.
            <br />
            Build Your Own Edge.
          </h1>
          <p className="lead rise d1" style={{ maxWidth: 860, lineHeight: 1.55 }}>
            MarkIQ SI is a market intelligence platform and trading academy. We turn official economic data and world news into clear, timely alerts. We teach traders from their first lesson to their first trading bot. And we give them professional tools to plan, test and manage every trade.
          </p>
        </div>
      </section>

      <section className="wrap" style={{ padding: '30px 16px 90px' }}>
        <div className="grid g-2" style={{ gap: 22 }}>
          <div className="stack on-navy" style={{ background: '#0B1A36', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(28px, 4vw, 48px)', gap: 16 }}>
            <span className="eyebrow">Our mission</span>
            <p className="display" style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(26px, 2.6vw, 36px)', lineHeight: 1.18 }}>To make professional market intelligence and trading education clear, honest and within reach of every trader.</p>
          </div>
          <div className="stack" style={{ background: '#1A5FD0', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(28px, 4vw, 48px)', gap: 16 }}>
            <span className="eyebrow" style={{ color: '#FFE2B0' }}>Our vision</span>
            <p className="display" style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(26px, 2.6vw, 36px)', lineHeight: 1.18 }}>A generation of traders who know why markets move, manage risk with discipline, and build their own technology instead of chasing signals.</p>
          </div>
        </div>
      </section>

      <section className="wrap stack" style={{ padding: '20px 16px 100px', gap: 30 }}>
        <Head eyebrow="Why we exist" title="Trading is hard enough. Getting the facts shouldn't be." />
        <div className="grid g-3" style={{ gap: 20 }}>
          {PROBLEMS.map((p) => (
            <div key={p.n} className="card stack" style={{ gap: 12 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 44, lineHeight: 1, color: 'var(--coral)' }}>{p.n}</span>
              <span className="display" style={{ fontWeight: 700, fontSize: 23, lineHeight: 1.2 }}>{p.title}</span>
              <span style={{ fontSize: 17, color: 'var(--text)' }}>{p.text}</span>
              <span style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                <strong style={{ color: 'var(--blue)' }}>Our answer:</strong> {p.answer}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#0B1A36', color: '#FFFFFF' }}>
        <div className="wrap stack" style={{ padding: '110px 16px', gap: 36 }}>
          <Head light eyebrow="What we do" title="Four parts, one platform" text="Each part works on its own, and together they take a trader from understanding the market to trading it with a plan, and finally to automating it." />
          <div className="grid g-4" style={{ gap: 20 }}>
            {PILLARS.map((x) => {
              const light = x.fg === '#FFFFFF';
              return (
                <article key={x.n} className="stack stripes" style={{ borderRadius: 30, padding: 30, gap: 14, color: x.fg, backgroundColor: x.bg }}>
                  <span className="mono" style={{ fontSize: 13, letterSpacing: '0.12em', opacity: 0.85 }}>{x.n}</span>
                  <span className="display" style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.1 }}>{x.title}</span>
                  <span style={{ fontSize: 17, opacity: 0.92 }}>{x.text}</span>
                  <div className="stack" style={{ gap: 10, marginTop: 4 }}>
                    {x.items.map((i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span aria-hidden="true" style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', marginTop: 8, background: light ? '#FFB547' : '#0B1A36' }} />
                        <span>{i}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={x.href} className={`btn btn-sm ${light ? 'btn-white' : ''}`} style={{ marginTop: 'auto', alignSelf: 'flex-start', ...(light ? {} : { background: '#0B1A36', color: '#FFFFFF' }) }}>
                    {x.cta} <span aria-hidden="true">»</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="wrap stack" style={{ padding: '110px 16px 60px', gap: 30 }}>
        <Head eyebrow="How our market intelligence works" title="From official source to your phone" />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {FLOW.map((f) => (
            <div key={f.n} className="card stack" style={{ gap: 10, borderTop: '6px solid var(--amber)', borderRadius: 26 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 36, lineHeight: 1, color: 'var(--blue)' }}>{f.n}</span>
              <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{f.title}</span>
              <span style={{ color: 'var(--text)' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ padding: '60px 16px 100px' }}>
        <div className="card-lg stack" style={{ gap: 30 }}>
          <Head eyebrow="What we stand for" title="Our promises to every trader" />
          <div className="grid g-3" style={{ gap: '26px 36px' }}>
            {VALUES.map((v) => (
              <div key={v.title} className="stack" style={{ gap: 8, paddingLeft: 20, borderLeft: '4px solid var(--blue)' }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>{v.title}</span>
                <span style={{ fontSize: 17, color: 'var(--text)' }}>{v.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap stack" style={{ padding: '0 16px 100px', gap: 30 }}>
        <Head eyebrow="Who we serve" title="Built for every stage of a trader's journey" />
        <div className="grid g-4" style={{ gap: 18 }}>
          {AUDIENCE.map((a) => (
            <div key={a.title} className="stack" style={{ borderRadius: 26, padding: 28, gap: 10, minHeight: 200, background: a.bg, color: a.fg }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 25, lineHeight: 1.1 }}>{a.title}</span>
              <span style={{ fontSize: 17 }}>{a.text}</span>
            </div>
          ))}
        </div>
      </section>

      <Founder label="Our founder" />

      <section style={{ background: 'linear-gradient(180deg, #0B1A36 0%, #0D2350 100%)', color: '#FFFFFF' }}>
        <div className="wrap stack" style={{ padding: '110px 16px', gap: 34 }}>
          <Head light eyebrow="Where we're headed" title="We're just getting started" text="We release features only when they work with real data. Here is what is available at launch, what is in beta, and what comes next." />
          <div className="grid g-3" style={{ gap: 20 }}>
            {ROAD.map((r) => (
              <div key={r.stage} className="stack" style={{ borderRadius: 28, padding: 28, gap: 14, ...(r.on ? { background: '#FFFFFF', color: '#0B1A36' } : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)' }) }}>
                <span style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 700, padding: '6px 16px', borderRadius: 999, marginBottom: 4, background: r.on ? '#3DDC97' : '#FFB547', color: '#0B1A36' }}>{r.stage}</span>
                {r.items.map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 17 }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', marginTop: 8, background: r.on ? '#1A5FD0' : '#FFB547' }} />
                    <span>{i}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stack center" style={{ padding: '110px 16px 40px', textAlign: 'center' }}>
        <div className="stack center" style={{ maxWidth: 1000, gap: 24 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(38px, 5.6vw, 80px)', lineHeight: 1, letterSpacing: '-0.035em' }}>
            Learn the Market.
            <br />
            Build the Technology.
          </h2>
          <p className="lead" style={{ maxWidth: 700 }}>Join MarkIQ SI to save your lessons, get market alerts on Telegram, and build and test your own trading bot.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
            <Link href="/get-started" className="btn btn-lg">Get Started <span className="arr" aria-hidden="true">»</span></Link>
            <a href={SITE.telegram || '/get-started'} className="btn btn-lg btn-outline">Join on Telegram <span className="arr" aria-hidden="true">»</span></a>
          </div>
        </div>
      </section>
      <div style={{ height: 80 }} />
      <HelpBlock />
    </>
  );
}
