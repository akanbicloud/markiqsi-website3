'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RiskCalculator } from './RiskCalculator';
import { PropTracker } from './PropTracker';
import { MarketScanner } from './MarketScanner';
import { Charts } from './Charts';
import { BotBuilder } from './BotBuilder';
import { Journal } from './Journal';

const TOOLS = [
  { key: 'risk', title: 'Risk Calculator', text: 'Know your trade size before you click buy or sell.', bg: '#1A5FD0', fg: '#FFFFFF' },
  { key: 'prop', title: 'Prop Challenge Tracker', text: 'Track your challenge: profit target, daily loss and drawdown left.', bg: '#FF7A45', fg: '#0B1A36' },
  { key: 'scan', title: 'Market Scanner', text: 'Scan many markets for supply and demand, candle patterns, ICT and SMC setups. Get Telegram alerts.', bg: '#7DB8FF', fg: '#0B1A36' },
  { key: 'charts', title: 'Charts', text: 'Real charts with years of history, indicators and drawing tools.', bg: '#3DDC97', fg: '#0B1A36' },
  { key: 'bot', title: 'Bot Builder', text: 'Turn your strategy into a robot you can test, then run on MT5.', bg: '#0B1A36', fg: '#FFFFFF' },
  { key: 'journal', title: 'Trading Journal', text: 'Log trades, see your P&L calendar, find what works.', bg: '#FFB547', fg: '#0B1A36' },
];

export function ToolsView({ signedIn }: { signedIn: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get('tool') || '';
  const [chartSym, setChartSym] = useState<string | undefined>(undefined);
  const view = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && view.current) view.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  function pick(k: string) {
    router.push(k ? `/tools?tool=${k}` : '/tools', { scroll: false });
  }

  return (
    <>
      <section className="hero-band stack center" style={{ padding: '90px 16px 40px', textAlign: 'center' }}>
        <h1 className="h1 rise" style={{ fontSize: 'clamp(42px, 6.8vw, 100px)' }}>Simple Tools for Smarter Trading</h1>
      </section>
      <section aria-label="All tools" className="wrap" style={{ padding: '0 16px 30px' }}>
        <p className="muted" style={{ margin: '0 0 18px', textAlign: 'center', fontSize: 19 }}>Pick a tool to open it.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {TOOLS.map((t) => {
            const on = open === t.key;
            const light = t.fg === '#FFFFFF';
            return (
              <button key={t.key} type="button" onClick={() => pick(t.key)} aria-expanded={on} className="lift stripes" style={{ minHeight: 260, borderRadius: 30, padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor: 'pointer', border: 'none', color: t.fg, backgroundColor: t.bg, outline: on ? '4px solid var(--ink)' : 'none', outlineOffset: 4 }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.05 }}>{t.title}</span>
                <span style={{ fontSize: 17, opacity: 0.88 }}>{t.text}</span>
                <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 50, padding: '0 24px', borderRadius: 999, fontWeight: 600, fontSize: 17, border: `1.5px solid ${light ? 'rgba(255,255,255,0.7)' : 'rgba(11,26,54,0.45)'}` }}>{on ? 'Opened below' : 'Open'} <span aria-hidden="true">»</span></span>
              </button>
            );
          })}
        </div>
      </section>
      <div ref={view} id="tool-view" style={{ scrollMarginTop: 20 }}>
        {open && (
          <section className="wrap stack" style={{ padding: '10px 16px 60px', gap: 14 }}>
            <button type="button" className="toggle" style={{ alignSelf: 'flex-end' }} onClick={() => pick('')}>Close tool</button>
            {open === 'risk' && <RiskCalculator />}
            {open === 'prop' && <PropTracker />}
            {open === 'scan' && <MarketScanner signedIn={signedIn} onOpenChart={(tv) => { setChartSym(tv); pick('charts'); }} />}
            {open === 'charts' && <Charts initial={chartSym} />}
            {open === 'bot' && <BotBuilder signedIn={signedIn} />}
            {open === 'journal' && <Journal signedIn={signedIn} />}
          </section>
        )}
      </div>
      <section className="wrap" style={{ padding: '30px 16px 30px' }}>
        <div style={{ border: '1.5px solid var(--ink)', borderRadius: 24, padding: '22px 26px', fontSize: 18 }}><strong>Demo first.</strong> These tools help you learn and plan. They are not financial advice, and past results never guarantee future results.</div>
      </section>
      <section className="stack center" style={{ padding: '60px 16px 120px', textAlign: 'center' }}>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(38px, 5.6vw, 80px)', lineHeight: 1, letterSpacing: '-0.035em' }}>Save Your Work, Free</h2>
        <p className="lead" style={{ maxWidth: 680, margin: '24px 0' }}>Create a free account to keep your journal, save your bots and get alerts on Telegram.</p>
        <a href={signedIn ? '/account' : '/get-started'} className="btn btn-lg">{signedIn ? 'My account' : 'Get Started'} <span className="arr" aria-hidden="true">»</span></a>
      </section>
    </>
  );
}
