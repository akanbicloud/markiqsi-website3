'use client';

import { useState } from 'react';
import { CURRENCIES } from '@/lib/terminal/strength';

const COL: Record<string, string> = { USD: '#1A5FD0', EUR: '#FFB547', GBP: '#E0592A', JPY: '#16a36a', AUD: '#8B5CF6', CAD: '#d4452f', CHF: '#0EA5E9', NZD: '#64748B' };
const FLAG: Record<string, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿' };

export function StrengthView({ periods, path, error }: { periods: { key: string; label: string; s: Record<string, number> | null }[]; path: { t: number; s: Record<string, number> | null }[]; error: string }) {
  const [k, setK] = useState('today');
  const p = periods.find((x) => x.key === k) || periods[0];
  const rows = p?.s ? CURRENCIES.map((c) => ({ c, v: p.s![c] ?? 0 })).sort((a, b) => b.v - a.v) : [];
  const max = Math.max(0.05, ...rows.map((r) => Math.abs(r.v)));
  const strong = rows[0], weak = rows[rows.length - 1];

  // line chart
  const W = 900, H = 260, P = 30;
  const vals = path.flatMap((x) => Object.values(x.s || {}));
  const lim = Math.max(0.1, ...vals.map(Math.abs));
  const X = (i: number) => P + (i / Math.max(1, path.length - 1)) * (W - 2 * P);
  const Y = (v: number) => H / 2 - (v / lim) * (H / 2 - 16);

  return (
    <section className="wrap stack" style={{ padding: '30px 16px 70px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">Currency Strength</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 860 }}>How each of the eight major currencies is doing against the others. Above zero means stronger than the group, below zero weaker. Built from real prices of the dollar pairs.</p>
      </div>
      {error && <div className="empty">{error}</div>}
      {!error && (
        <>
          <div role="tablist" aria-label="Period" className="tabs">
            {periods.map((x) => <button key={x.key} type="button" role="tab" aria-selected={x.key === k} className="toggle" onClick={() => setK(x.key)}>{x.label}</button>)}
          </div>
          {!rows.length ? <div className="empty">Prices for this period are still loading. Please check back in a few minutes.</div> : (
            <div className="row" style={{ gap: 18, alignItems: 'stretch' }}>
              <div className="card stack" style={{ flex: '2 1 520px', borderRadius: 22, padding: 22, gap: 10 }}>
                {rows.map((r) => (
                  <div key={r.c} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 70px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}><span aria-hidden="true">{FLAG[r.c]}</span> {r.c}</span>
                    <span style={{ position: 'relative', height: 22, background: 'var(--inset)', borderRadius: 6 }}>
                      <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
                      <span style={{ position: 'absolute', top: 3, bottom: 3, borderRadius: 4, background: r.v >= 0 ? '#16a36a' : '#d4452f', left: r.v >= 0 ? '50%' : `${50 - (Math.abs(r.v) / max) * 50}%`, width: `${(Math.abs(r.v) / max) * 50}%` }} />
                    </span>
                    <span className="mono" style={{ textAlign: 'right', color: r.v >= 0 ? '#16a36a' : '#d4452f', fontWeight: 600 }}>{r.v > 0 ? '+' : ''}{r.v.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
              <div className="stack" style={{ flex: '1 1 260px', borderRadius: 22, padding: 22, gap: 10, background: '#0B1A36', color: '#fff' }}>
                <span className="mono" style={{ color: '#FFB547', fontSize: 13, letterSpacing: '0.1em' }}>{p.label.toUpperCase()}</span>
                <span style={{ fontSize: 18 }}>Strongest: <strong>{FLAG[strong.c]} {strong.c}</strong></span>
                <span style={{ fontSize: 18 }}>Weakest: <strong>{FLAG[weak.c]} {weak.c}</strong></span>
                <span style={{ color: '#C9D6EE' }}>The biggest gap is between {strong.c} and {weak.c} ({(strong.v - weak.v).toFixed(2)}%). Traders often watch the strongest against the weakest, but a gap can also close fast. Check the chart and the news first.</span>
              </div>
            </div>
          )}
          {path.length > 3 && (
            <div className="card stack" style={{ borderRadius: 22, padding: 22, gap: 10 }}>
              <h2 className="display" style={{ fontWeight: 700, fontSize: 21, margin: 0 }}>Last 48 hours</h2>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Currency strength over the last 48 hours">
                <line x1={P} x2={W - P} y1={H / 2} y2={H / 2} stroke="var(--line)" />
                {CURRENCIES.map((c) => (
                  <polyline key={c} fill="none" stroke={COL[c]} strokeWidth={2} points={path.map((x, i) => `${X(i)},${Y(x.s?.[c] ?? 0)}`).join(' ')} />
                ))}
                {CURRENCIES.map((c) => { const v = path[path.length - 1].s?.[c] ?? 0; return <text key={c} x={W - P + 4} y={Y(v) + 4} fontSize={11} fill={COL[c]} fontWeight={700}>{c}</text>; })}
              </svg>
              <div className="row small" style={{ gap: 12 }}>{CURRENCIES.map((c) => <span key={c} style={{ color: COL[c], fontWeight: 700 }}>■ {c}</span>)}</div>
            </div>
          )}
          <p className="small faint" style={{ margin: 0 }}>Each currency’s change against the US dollar, minus the average of all eight. Prices update every hour. For learning, not financial advice.</p>
        </>
      )}
    </section>
  );
}
