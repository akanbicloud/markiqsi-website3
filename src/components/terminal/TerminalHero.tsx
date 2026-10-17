'use client';

import Link from 'next/link';
import { C, TerminalChart, fmtPrice, heat, pressureWord } from './TerminalChart';
import { useChart } from './useChart';
import { MARKET_PAGES } from './MarketsNav';

const TOOLS = MARKET_PAGES.slice(1);

/** Live demo at the top of Markets: gold, last 10 days, sweeping reveal line. Real data only. */
export function TerminalHero() {
  const { data, error, loading } = useChart('XAUUSD', 200);
  const last = data?.candles[data.candles.length - 1];
  return (
    <section aria-labelledby="live-h" style={{ background: 'linear-gradient(180deg, #060F22 0%, #0B1A36 100%)', color: '#fff' }}>
      <div className="wrap stack" style={{ padding: '70px 16px 56px', gap: 22 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 18 }}>
          <div className="stack" style={{ gap: 10, maxWidth: 760 }}>
            <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, letterSpacing: '0.12em', color: '#FFB547' }}>
              <span className="pulse" aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: '#3DDC97' }} />LIVE MARKET TERMINAL · GOLD
            </span>
            <h1 className="h1" style={{ color: '#fff' }}>See Why the Market Moved</h1>
            <p className="lead" style={{ color: '#C9D6EE', margin: 0 }}>
              Every big release and headline pinned to the candle where it hit. The glowing band shows how hard the linked markets were pushing gold: green up, red down, wider means stronger. Drag the gold line to replay it.
            </p>
          </div>
          {last && (
            <div className="stack" style={{ gap: 6, minWidth: 220 }}>
              <span className="small" style={{ color: '#9FB2D6' }}>Gold now</span>
              <span className="mono" style={{ fontSize: 30 }}>${fmtPrice(last.c, data!.digits)}</span>
              <span style={{ fontWeight: 700, color: last.score == null ? '#9FB2D6' : last.score >= 0 ? C.mint : C.coral }}>
                Pressure {last.score == null ? '·' : `${last.score > 0 ? '+' : ''}${last.score}`} · {pressureWord(last.score)}
              </span>
            </div>
          )}
        </div>

        <div style={{ borderRadius: 22, padding: 2, background: 'linear-gradient(135deg, rgba(255,181,71,0.6), rgba(61,220,151,0.25), rgba(255,107,90,0.35))', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
          {data ? (
            <TerminalChart data={data} mode="hero" height={440} onSelect={(i) => { window.location.href = `/markets/terminal?market=XAUUSD&t=${data.candles[i].t}`; }} />
          ) : (
            <div className="stack center" style={{ height: 440, borderRadius: 20, background: C.bg, justifyContent: 'center', textAlign: 'center', padding: 24, color: '#B9C9E6' }}>
              {loading ? <span className="pulse">Loading the live gold chart…</span> : <span>{error}</span>}
            </div>
          )}
        </div>

        {data && (
          <div className="row" style={{ gap: '10px 22px', alignItems: 'center' }}>
            <span className="row" style={{ gap: 6, alignItems: 'center' }} aria-label="Pressure colour key">
              <span className="small" style={{ color: '#9FB2D6' }}>Down</span>
              {[-90, -60, -30, 0, 30, 60, 90].map((s) => <span key={s} style={{ width: 22, height: 10, borderRadius: 3, background: heat(s) }} />)}
              <span className="small" style={{ color: '#9FB2D6' }}>Up</span>
            </span>
            {data.pricingIn.length > 0 && (
              <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className="small" style={{ color: '#9FB2D6' }}>Pricing in:</span>
                {data.pricingIn.map((p) => <span key={p} style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(255,181,71,0.14)', color: '#FFB547', fontSize: 14, fontWeight: 600 }}>{p}</span>)}
              </span>
            )}
            <span className="small" style={{ color: '#7F93B8', marginLeft: 'auto' }}>1-hour candles · updates hourly · not financial advice</span>
          </div>
        )}

        <div className="grid g-3" style={{ gap: 12 }}>
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="lift" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none' }}>
              <span aria-hidden="true" style={{ fontSize: 24 }}>{t.icon}</span>
              <span className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700 }}>{t.label} <span style={{ color: '#FFB547' }}>»</span></span>
                <span className="small" style={{ color: '#B9C9E6' }}>{t.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
