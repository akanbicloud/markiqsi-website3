import Link from 'next/link';
import { HelpBlock } from '@/components/HelpBlock';
import { Founder } from '@/components/Founder';
import { SITE } from '@/lib/site';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { TrackFan } from '@/components/motion/TrackFan';

const TRACKS = [
  { title: 'Risk Management', level: 'All levels', bg: '#FFB547', fg: '#0B1A36', points: ['Position sizing: how much to trade', 'Stop losses that make sense', 'Trading psychology and discipline'] },
  { title: 'Technical Analysis', level: 'Beginner → Intermediate', bg: '#3DDC97', fg: '#0B1A36', points: ['Candlesticks and reading charts', 'Price action and market structure', 'Building your own trading plan'] },
  { title: 'Trading Automation', level: 'Intermediate → Advanced', bg: '#0B1A36', fg: '#FFFFFF', points: ['Turn your strategy into a bot with Pine Script and MQL5', 'Build and test a strategy the right way', 'Deploy your bot to MT5 and trade it live', 'Publish and sell your bot or indicator'] },
  { title: 'Fundamental Analysis', level: 'Beginner → Intermediate', bg: '#1A5FD0', fg: '#FFFFFF', points: ['How news, inflation and jobs data move markets', 'Central banks and interest rates', 'Geopolitics: wars, elections, sanctions and trade', 'Trading the news safely'] },
  { title: 'Live Classes', level: 'All levels', bg: '#FF7A45', fg: '#0B1A36', points: ['Physical classes in person', 'Virtual sessions online', 'Ask a mentor your questions'] },
];

const PATHS = [
  { title: 'Learn', items: ['Beginner-friendly lessons', 'Fundamental & technical analysis', 'Risk management made simple', 'Physical classes + virtual sessions'], cta: 'Start Learning', href: '/#learn', bg: 'linear-gradient(180deg, #1A5FD0 0%, #2F7BE0 100%)', dark: false },
  { title: 'Follow the Market', items: ['Alerts before and after big news', 'News explained in plain words', 'Central bank broadcasts, live', 'Alerts on Telegram'], cta: 'See Markets', href: '/markets', bg: 'linear-gradient(180deg, #123F86 0%, #2B5FAE 100%)', dark: false },
  { title: 'Build & Automate', items: ['Describe your strategy in plain words', 'Build your bot (Pine Script & MQL5)', 'Backtest it and run it on demo', 'Deploy it to MT5 and trade live'], cta: 'Start Building', href: '/tools?tool=bot', bg: 'linear-gradient(180deg, #FFC461 0%, #FFB547 100%)', dark: true },
];

const DIFF = [
  { title: 'Real Data, Never Guesses', text: 'Every number comes from official sources like the US Bureau of Labor Statistics and central banks, dated and sourced. Our AI explains the data; it never makes it up.', img: '/images/different-1.jpg', alt: 'A phone showing a market alert', grad: 'linear-gradient(160deg, #6FA8F5 0%, #1A5FD0 60%, #0D2350 100%)' },
  { title: 'Alerts Before and After the News', text: 'Get a heads-up before big news, then the result and what it means the moment it is released, straight to Telegram.', img: '/images/different-2.jpg', alt: 'A hand holding a phone with a notification', grad: 'linear-gradient(160deg, #FFD38A 0%, #F09A1A 55%, #8A4B00 100%)' },
  { title: 'Build, Test, Then Go Live', text: 'Our Bot Builder turns your strategy into a working bot, tests it on past data and a demo account, then helps you run it live on your own MT5.', img: '/images/different-3.jpg', alt: 'A laptop with code beside a trading chart', grad: 'linear-gradient(160deg, #3DDC97 0%, #128A5B 55%, #0B1A36 100%)' },
];

export default function Home() {
  return (
    <>
      <section className="hero-band center stack" style={{ padding: '120px 16px 50px' }}>
        <div className="stack center" style={{ maxWidth: 1100, margin: '0 auto', gap: 22 }}>
          <h1 className="h1 rise" style={{ fontSize: 'clamp(44px, 7.2vw, 108px)' }}>
            Learn the Market
            <br />
            Build the Technology
          </h1>
          <p className="rise d1" style={{ margin: 0, fontSize: 'clamp(20px, 2.2vw, 28px)', fontWeight: 600, color: 'var(--blue)' }}>
            Market Intelligence &amp; Academy
          </p>
          <p className="lead rise d1" style={{ maxWidth: 760 }}>
            Live market alerts, trading courses, and the tools to build, test and run your own trading bots.
          </p>
          <div className="row rise d1" style={{ justifyContent: 'center', gap: 10 }}>
            {['Forex', 'Crypto', 'Stocks', 'Commodities'].map((m) => (
              <span key={m} style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '8px 20px', fontSize: 17, background: 'var(--surface)' }}>
                {m}
              </span>
            ))}
          </div>
          <div className="row rise d2" style={{ justifyContent: 'center', gap: 14, marginTop: 8 }}>
            <Link href="/#learn" className="btn btn-lg">
              Start Learning <span className="arr" aria-hidden="true">»</span>
            </Link>
            <Link href="/tools?tool=bot" className="btn btn-lg btn-outline">
              Start Building <span className="arr" aria-hidden="true">»</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="learn" aria-labelledby="courses-h" style={{ padding: '40px 0 120px', scrollMarginTop: 20, overflowX: 'clip' }}>
        <Reveal className="stack center" style={{ gap: 14, padding: '0 16px 0' }}>
          <h2 id="courses-h" className="h2">What You&apos;ll Learn</h2>
          <p className="lead">Four clear tracks plus live classes, all in plain words.</p>
        </Reveal>
        <TrackFan tracks={TRACKS} />
        <div className="stack center" style={{ gap: 18, marginTop: 30, padding: '0 16px' }}>
          <span style={{ fontSize: 20, fontWeight: 500 }}>Start as a beginner. Finish building your own trading robot.</span>
          <Link href="/get-started" className="btn">
            See all courses <span className="arr" aria-hidden="true">»</span>
          </Link>
        </div>
      </section>

      <section className="on-navy" style={{ background: '#0B1A36', color: '#FFFFFF' }}>
        <div className="wrap stack" style={{ padding: '110px 16px', gap: 40 }}>
          <Reveal>
            <h2 className="h2 center" style={{ textAlign: 'center' }}>
              Choose Your <span style={{ color: '#FFB547' }}>Path</span>
            </h2>
          </Reveal>
          <RevealGroup className="grid g-3" style={{ gap: 20 }}>
            {PATHS.map((p) => (
              <RevealItem key={p.title} className="stack" style={{ borderRadius: 36, padding: '52px 40px', gap: 28, background: p.bg, color: p.dark ? '#0B1A36' : '#FFFFFF' }}>
                <h3 className="display" style={{ fontSize: 40, lineHeight: 1.02 }}>{p.title}</h3>
                <div className="stack" style={{ gap: 14 }}>
                  {p.items.map((i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, fontSize: 19, lineHeight: 1.4 }}>
                      <span aria-hidden="true" style={{ flex: 'none', width: 12, height: 12, borderRadius: '50%', marginTop: 8, background: p.dark ? '#0B1A36' : '#FFB547' }} />
                      <span>{i}</span>
                    </div>
                  ))}
                </div>
                <Link href={p.href} className={`btn ${p.dark ? '' : 'btn-white'}`} style={{ alignSelf: 'flex-start', marginTop: 'auto', ...(p.dark ? { background: '#0B1A36', color: '#FFFFFF' } : {}) }}>
                  {p.cta} <span aria-hidden="true">»</span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 19, color: '#B9C9E6' }}>
            Questions?{' '}
            <Link href="/faqs" style={{ color: '#FFFFFF', fontWeight: 600 }}>
              Read the FAQs <span aria-hidden="true" style={{ color: '#FFB547' }}>»</span>
            </Link>{' '}
            or call{' '}
            <a href={`tel:${SITE.phoneTel}`} style={{ color: '#FFFFFF', fontWeight: 600 }}>
              {SITE.phoneDisplay}
            </a>
            .
          </p>
        </div>
      </section>

      <section className="wrap stack" style={{ padding: '120px 16px 40px', gap: 40 }}>
        <Reveal className="stack center" style={{ gap: 14, textAlign: 'center' }}>
          <h2 className="h2">
            What Makes <span style={{ color: 'var(--blue)' }}>MarkIQ SI</span> Different
          </h2>
          <p className="lead" style={{ maxWidth: 760 }}>Official data, smart tools and a clear path from your first lesson to your own trading bot.</p>
        </Reveal>
        <RevealGroup className="grid g-3" style={{ gap: 22 }}>
          {DIFF.map((d) => (
            <RevealItem key={d.title} style={{ display: 'flex' }}>
            <article style={{ flex: 1, background: 'var(--surface)', borderRadius: 30, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div role="img" aria-label={d.alt} style={{ aspectRatio: '4 / 3', background: `url(${d.img}) center / cover no-repeat, ${d.grad}` }} />
              <div className="stack" style={{ padding: 28, gap: 12 }}>
                <h3 className="display" style={{ fontSize: 27, lineHeight: 1.12 }}>{d.title}</h3>
                <p style={{ margin: 0, fontSize: 17, color: 'var(--text)' }}>{d.text}</p>
              </div>
            </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <Founder id="about" />
      <HelpBlock />

      <section className="stack center" style={{ padding: '20px 16px 130px', textAlign: 'center' }}>
        <Reveal className="stack center" style={{ maxWidth: 1000, margin: '0 auto', gap: 24 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(40px, 6vw, 86px)', lineHeight: 1, letterSpacing: '-0.035em' }}>Start Learning. Start Building.</h2>
          <p className="lead" style={{ maxWidth: 720 }}>Create a free account to save your lessons, get market alerts on Telegram, and build and test your own trading bot.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
            <Link href="/get-started" className="btn btn-lg">
              Create a Free Account <span className="arr" aria-hidden="true">»</span>
            </Link>
            <a href={SITE.telegram || '/get-started'} className="btn btn-lg btn-outline">
              Join on Telegram <span className="arr" aria-hidden="true">»</span>
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
