'use client';

import { useState } from 'react';

const PAIRS: { k: string; pipValue: number | null; note?: string }[] = [
  { k: 'EURUSD', pipValue: 10 },
  { k: 'GBPUSD', pipValue: 10 },
  { k: 'AUDUSD', pipValue: 10 },
  { k: 'NZDUSD', pipValue: 10 },
  { k: 'XAUUSD (gold, 1 pip = $0.10)', pipValue: 10, note: 'For gold we count 1 pip as $0.10 of price. 1 standard lot = 100 ounces.' },
  { k: 'Other (enter pip value)', pipValue: null },
];

export function RiskCalculator() {
  const [bal, setBal] = useState('1000');
  const [risk, setRisk] = useState('1');
  const [sl, setSl] = useState('20');
  const [pair, setPair] = useState(PAIRS[0].k);
  const [custom, setCustom] = useState('10');
  const p = PAIRS.find((x) => x.k === pair)!;
  const pv = p.pipValue ?? (parseFloat(custom) || 0);
  const b = parseFloat(bal) || 0;
  const r = parseFloat(risk) || 0;
  const s = parseFloat(sl) || 0;
  const money = b * r / 100;
  const raw = s > 0 && pv > 0 ? money / (s * pv) : 0;
  const lots = Math.floor(raw * 100) / 100;
  const atRisk = lots * s * pv;
  const valid = b > 0 && r > 0 && s > 0 && pv > 0;
  const high = r > 2;
  let sentence = 'Enter your balance, risk and stop loss.';
  if (valid && lots < 0.01) sentence = 'This trade would be smaller than the minimum 0.01 lots. Try a bigger balance, a higher risk % or a smaller stop loss.';
  else if (valid) sentence = `If your stop loss is hit, you lose about $${atRisk.toFixed(2)} (${((atRisk / b) * 100).toFixed(1)}% of your account).`;

  const field = (id: string, label: string, v: string, set: (x: string) => void, step = 'any') => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" inputMode="decimal" min="0" step={step} value={v} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <div className="card-lg row" style={{ gap: 40 }}>
      <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 20 }}>
        <h2 className="h2">Risk Calculator</h2>
        <p style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Find out how big your trade should be, so one bad trade never hurts too much.</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {field('rc-bal', 'Account balance (USD)', bal, setBal)}
          {field('rc-risk', 'Risk per trade (%)', risk, setRisk, '0.5')}
          {field('rc-sl', 'Stop loss (pips)', sl, setSl)}
          <div className="field">
            <label htmlFor="rc-pair">Market</label>
            <select id="rc-pair" className="input select" value={pair} onChange={(e) => setPair(e.target.value)}>
              {PAIRS.map((x) => <option key={x.k} value={x.k}>{x.k}</option>)}
            </select>
          </div>
          {p.pipValue === null && field('rc-pv', 'Pip value for 1 lot (USD)', custom, setCustom)}
        </div>
        <span className="small faint">{p.note || (p.pipValue === null ? 'Find the pip value for 1 lot in your broker’s contract specifications.' : 'For pairs priced in US dollars, 1 pip on 1 standard lot is worth $10.')}</span>
      </div>
      <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 16 }}>
        <div className="stack" style={{ background: '#0B1A36', color: '#FFFFFF', borderRadius: 28, padding: 32, gap: 14 }}>
          <span className="mono" style={{ fontSize: 13, letterSpacing: '0.14em', color: '#FFB547' }}>YOUR TRADE SIZE</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 'clamp(46px, 6vw, 78px)', lineHeight: 1 }} aria-live="polite">{lots.toFixed(2)} lots</span>
          <span style={{ fontSize: 20, color: '#DCE6F7' }}>{sentence}</span>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px' }}><div style={{ fontSize: 13, color: '#B9C9E6' }}>Money at risk</div><div className="mono" style={{ fontSize: 22 }}>${atRisk.toFixed(2)}</div></div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px' }}><div style={{ fontSize: 13, color: '#B9C9E6' }}>Each pip is worth</div><div className="mono" style={{ fontSize: 22 }}>${(lots * pv).toFixed(2)}</div></div>
          </div>
        </div>
        <div className={`note ${high ? 'note-bad' : 'note-ok'}`}>{high ? 'Careful: risking more than 2% per trade can empty an account fast. Most beginners use 1%.' : 'Good habit: risking 1–2% per trade means a losing streak will not wipe out your account.'}</div>
      </div>
    </div>
  );
}
