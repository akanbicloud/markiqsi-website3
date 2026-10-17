'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MARKETS } from '@/lib/terminal/pressure';
import { C, TerminalChart, heat, pressureWord } from './TerminalChart';
import { useChart } from './useChart';

type WhyRes = { time: number; move: number; facts: string[]; events: { icon: string; head: string; detail: string; when: string }[]; ai: string | null; note?: string };

export function TerminalView() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = (sp.get('market') || 'XAUUSD').toUpperCase();
  const [market, setMarket] = useState(MARKETS.some((m) => m.key === initial) ? initial : 'XAUUSD');
  const { data, error, loading } = useChart(market, 300);
  const [sel, setSel] = useState<number | null>(null);
  const [why, setWhy] = useState<WhyRes | null>(null);
  const [whyErr, setWhyErr] = useState('');
  const [busy, setBusy] = useState(false);

  // open the candle passed from the hero (?t=)
  useEffect(() => {
    const t = Number(sp.get('t'));
    if (!data || !t) return;
    const i = data.candles.findIndex((c) => c.t === t);
    if (i >= 0) pick(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function pick(i: number) {
    if (!data) return;
    setSel(i); setBusy(true); setWhyErr(''); setWhy(null);
    try {
      const r = await fetch('/api/markets/why', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market, t: data.candles[i].t }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) setWhyErr(d.error || 'Could not explain this candle just now.');
      else setWhy(d);
    } catch { setWhyErr('Could not reach MarkIQ. Check your connection.'); }
    setBusy(false);
  }

  function choose(k: string) {
    setMarket(k); setSel(null); setWhy(null);
    router.replace(`/markets/terminal?market=${k}`, { scroll: false });
  }

  const last = data?.candles[data.candles.length - 1];
  return (
    <section className="wrap stack" style={{ padding: '30px 16px 60px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">Market Terminal</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 860 }}>
          One-hour candles with every big release and tagged headline pinned where it landed (▲ the market rose that hour, ▼ it fell). The glowing band is MarkIQ Pressure: how hard the linked markets were pushing. Click any candle to see why it moved.
        </p>
      </div>
      <div role="tablist" aria-label="Market" className="tabs" style={{ overflowX: 'auto' }}>
        {MARKETS.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={m.key === market} className="toggle" onClick={() => choose(m.key)}>{m.label}</button>
        ))}
      </div>

      <div className="row" style={{ gap: 18, alignItems: 'stretch' }}>
        <div className="stack" style={{ flex: '1 1 640px', minWidth: 0, gap: 10 }}>
          {data ? (
            <TerminalChart data={data} mode="full" height={520} selected={sel} onSelect={pick} />
          ) : (
            <div className="stack center" style={{ height: 520, borderRadius: 18, background: C.bg, justifyContent: 'center', color: '#B9C9E6', padding: 24, textAlign: 'center' }}>
              {loading ? <span className="pulse">Loading {MARKETS.find((m) => m.key === market)?.label}…</span> : error}
            </div>
          )}
          {data && (
            <div className="row small faint" style={{ gap: '6px 18px', alignItems: 'center' }}>
              <span className="row" style={{ gap: 4, alignItems: 'center' }}>Pressure {[-90, -45, 0, 45, 90].map((s) => <span key={s} style={{ width: 16, height: 8, borderRadius: 2, background: heat(s) }} />)}</span>
              <span>📊 data release · 🏦 central bank · ⚔️ war/geopolitics · 🇺🇸 Trump · 🚢 trade · 🛢️ energy</span>
              <span>Drag the gold handle at the right edge to replay.</span>
            </div>
          )}
        </div>

        <aside className="card stack" style={{ flex: '1 1 300px', maxWidth: 420, borderRadius: 22, padding: 22, gap: 12 }} aria-live="polite">
          {last && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="small faint">{data!.label} now</span>
              <span style={{ fontWeight: 700, color: last.score == null ? 'var(--muted)' : last.score >= 0 ? '#16a36a' : '#d4452f' }}>
                Pressure {last.score == null ? '·' : `${last.score > 0 ? '+' : ''}${last.score}`}: {pressureWord(last.score)}
              </span>
              {data!.pricingIn.length > 0 && <span className="small">Pricing in: <strong>{data!.pricingIn.join(' · ')}</strong></span>}
            </div>
          )}
          <hr style={{ border: 0, borderTop: '1px solid var(--line-soft)', margin: '4px 0' }} />
          <h2 className="display" style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Why did it move?</h2>
          {sel == null && <p className="muted" style={{ margin: 0 }}>Click a candle on the chart.</p>}
          {busy && <p className="pulse" style={{ margin: 0 }}>Reading that candle…</p>}
          {whyErr && <p style={{ margin: 0, color: '#d4452f' }}>{whyErr}</p>}
          {why && (
            <div className="stack" style={{ gap: 10 }}>
              <span className="mono small faint">{new Date(why.time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {why.ai && <p style={{ margin: 0, fontSize: 17 }}><strong style={{ color: 'var(--blue)' }}>Simply:</strong> {why.ai}</p>}
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, color: 'var(--text)' }}>
                {why.facts.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {why.events.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <strong>What happened</strong>
                  {why.events.map((e) => (
                    <div key={e.head + e.when} className="inset" style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{e.icon} {e.head} <span className="small faint">· {e.when}</span></div>
                      {e.detail && <div className="small">{e.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
              {why.note && <span className="small faint">{why.note}</span>}
            </div>
          )}
          <p className="small faint" style={{ margin: 'auto 0 0' }}>MarkIQ Pressure is built from real price moves of linked markets (the US dollar, oil, stocks, Bitcoin, gold). It is not order-flow data and not financial advice.</p>
        </aside>
      </div>
    </section>
  );
}
