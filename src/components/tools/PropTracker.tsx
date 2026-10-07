'use client';

import { useEffect, useState } from 'react';

const FIELDS: [string, string][] = [
  ['acc', 'Account size (USD)'],
  ['target', 'Profit target (%)'],
  ['daily', 'Max daily loss (%)'],
  ['max', 'Max total loss (%)'],
  ['today', 'Today’s profit or loss (USD)'],
  ['total', 'Total profit or loss so far (USD)'],
];

export function PropTracker() {
  const [v, setV] = useState<Record<string, string>>({ acc: '100000', target: '8', daily: '5', max: '10', today: '0', total: '0' });
  useEffect(() => {
    try {
      const s = localStorage.getItem('mq-prop');
      if (s) setV(JSON.parse(s));
    } catch {}
  }, []);
  function set(k: string, x: string) {
    const n = { ...v, [k]: x };
    setV(n);
    try { localStorage.setItem('mq-prop', JSON.stringify(n)); } catch {}
  }
  const f = (k: string) => { const n = parseFloat(v[k]); return Number.isFinite(n) ? n : 0; };
  const acc = Math.max(0, f('acc'));
  const tgt = acc * Math.max(0, f('target')) / 100;
  const dLim = acc * Math.max(0, f('daily')) / 100;
  const mLim = acc * Math.max(0, f('max')) / 100;
  const today = f('today');
  const total = f('total');
  const dRoom = dLim + Math.min(0, today);
  const mRoom = mLim + total;
  const usd = (x: number) => (x < 0 ? '-$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US');
  const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
  const broken = dRoom <= 0 || mRoom <= 0;
  const passed = !broken && tgt > 0 && total >= tgt;
  const careful = !broken && (dRoom < dLim * 0.3 || mRoom < mLim * 0.3);
  const status = broken ? 'Rule broken' : passed ? 'Target reached' : careful ? 'Careful' : 'On track';
  const bars = [
    { label: 'Profit target', value: `${usd(Math.max(0, total))} of ${usd(tgt)}`, p: pct(Math.max(0, total), tgt), col: '#3DDC97', note: tgt > total ? `${usd(tgt - total)} left to pass` : 'Target reached. Check your firm’s other rules, like minimum trading days.' },
    { label: 'Daily loss room left', value: `${usd(Math.max(0, dRoom))} of ${usd(dLim)}`, p: pct(Math.max(0, dRoom), dLim), col: dRoom < dLim * 0.3 ? '#E0592A' : '#7DB8FF', note: `Today you can lose ${usd(Math.max(0, dRoom))} more before breaking the daily rule.` },
    { label: 'Total loss room left', value: `${usd(Math.max(0, mRoom))} of ${usd(mLim + Math.max(0, total))}`, p: pct(Math.max(0, mRoom), mLim + Math.max(0, total)), col: mRoom < mLim * 0.3 ? '#E0592A' : '#7DB8FF', note: `Your account must stay above ${usd(acc - mLim)}.` },
  ];
  return (
    <div className="card-lg row" style={{ gap: 40 }}>
      <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 20 }}>
        <h2 className="h2">Prop Challenge Tracker</h2>
        <p style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Taking a prop firm challenge? Enter your rules and results to see how close you are to passing, and how much room you have before you break a rule.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {FIELDS.map(([k, label]) => (
            <div key={k} className="field">
              <label htmlFor={`pf-${k}`}>{label}</label>
              <input id={`pf-${k}`} className="input" type="number" step="any" inputMode="decimal" value={v[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </div>
        <span className="small faint">Every prop firm has its own rules. Check yours and enter them here. Losses are entered as minus numbers. Your numbers stay on this device.</span>
      </div>
      <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 16 }}>
        <div className="stack" style={{ background: '#0B1A36', color: '#FFFFFF', borderRadius: 28, padding: 32, gap: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 13, letterSpacing: '0.14em', color: '#FFB547' }}>YOUR CHALLENGE</span>
            <span aria-live="polite" style={{ fontSize: 13, fontWeight: 700, padding: '5px 14px', borderRadius: 999, background: broken ? '#E0592A' : careful ? '#FFB547' : '#3DDC97', color: broken ? '#FFFFFF' : '#0B1A36' }}>{status}</span>
          </div>
          {bars.map((b) => (
            <div key={b.label} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}><span style={{ fontWeight: 600 }}>{b.label}</span><span className="mono">{b.value}</span></div>
              <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${b.p}%`, background: b.col, borderRadius: 999 }} /></div>
              <span className="small" style={{ color: '#B9C9E6' }}>{b.note}</span>
            </div>
          ))}
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: '#B9C9E6' }}>Safe risk per trade right now</div>
            <div className="mono" style={{ fontSize: 24 }}>{usd(Math.max(0, Math.min(dRoom, mRoom) / 4))}</div>
            <div className="small" style={{ color: '#B9C9E6' }}>So 4 losses in a row still won’t break your daily limit.</div>
          </div>
        </div>
        <div className={`note ${broken ? 'note-bad' : careful ? 'note-warn' : 'note-ok'}`}>
          {broken ? 'A loss limit has been hit. On most prop firms this ends the challenge. Stop trading and review what happened.' : careful ? 'You are close to a loss limit. Trade smaller or stop for today.' : 'Good: you have room. Keep risk small so one bad day cannot end your challenge.'}
        </div>
      </div>
    </div>
  );
}
