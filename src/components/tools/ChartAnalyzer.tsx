'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SYMBOLS, TIMEFRAMES, type TF } from '@/lib/trading/symbols';
import type { Brain, Check, Plan } from '@/lib/trading/chartbrain';
import type { ChartAnalysis } from '@/lib/trading/chartreview';
import { ZoneChart } from './ZoneChart';

type Result = {
  market: string;
  timeframe: string;
  digits: number;
  structure: { lastClose: number; lastTime: string; trend: { bias: string }; structure: string; rsi14: number };
  brain: Brain;
  analysis: ChartAnalysis;
  remaining: number;
  ai?: boolean;
  aiNote?: string;
};

/** Shrinks the screenshot in the browser so uploads stay small and fast on mobile data. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error('That file is not an image we can read.'));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const BIAS_STYLE: Record<'Bullish' | 'Bearish' | 'Neutral', { bg: string; fg: string }> = {
  Bullish: { bg: 'var(--mint-soft)', fg: '#0B4A2E' },
  Bearish: { bg: 'var(--coral-soft)', fg: '#7A2508' },
  Neutral: { bg: 'var(--blue-soft)', fg: 'var(--ink)' },
};

const LEAN_ICON: Record<Check['lean'], { icon: string; colour: string; word: string }> = {
  bullish: { icon: '▲', colour: '#0B7A45', word: 'Leans bullish' },
  bearish: { icon: '▼', colour: '#B23C12', word: 'Leans bearish' },
  neutral: { icon: '•', colour: 'var(--muted)', word: 'Neutral' },
  caution: { icon: '!', colour: '#9A6200', word: 'Caution' },
};

function EvidenceMeter({ bullish, bearish }: { bullish: number; bearish: number }) {
  const total = Math.max(1, bullish + bearish);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--inset)' }} aria-hidden="true">
        <div style={{ width: `${(bullish / total) * 100}%`, background: '#16A34A' }} />
        <div style={{ width: `${(bearish / total) * 100}%`, background: '#E0592A' }} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: '#0B7A45', fontWeight: 600 }}>▲ {bullish} bullish</span>
        <span style={{ color: '#B23C12', fontWeight: 600 }}>{bearish} bearish ▼</span>
      </div>
    </div>
  );
}

function PlanCard({ p, note }: { p: Plan; note?: string }) {
  const st = BIAS_STYLE[p.bias];
  return (
    <div className="card stack" style={{ gap: 8, background: st.bg, color: st.fg, borderColor: p.leans ? st.fg : 'transparent', borderWidth: p.leans ? 2 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 20 }}>Plan {p.id} · {p.bias} {p.kind.toLowerCase()}</strong>
        {p.leans && <span className="chip" style={{ background: st.fg, color: '#fff' }}>Evidence favours</span>}
      </div>
      <span><strong>If:</strong> {p.when}</span>
      <span><strong>Wrong if:</strong> {p.wrongIf}</span>
      <span><strong>Aim:</strong> {p.aim}</span>
      <div className="row" style={{ gap: 14, fontSize: 15, marginTop: 2 }}>
        <span>Trigger <strong>{p.trigger}</strong></span>
        <span>Invalidation <strong>{p.invalidation}</strong></span>
        {p.target != null && <span>Target <strong>{p.target}</strong></span>}
        {p.rr != null && <span>Reward to risk <strong>1 : {p.rr}</strong></span>}
      </div>
      {p.rr != null && p.rr < 1.5 && <span style={{ fontSize: 14 }}>⚠ Reward to risk is under 1 : 1.5, so this idea needs extra confirmation.</span>}
      {note && <span style={{ fontSize: 15, opacity: 0.9 }}>{note}</span>}
    </div>
  );
}

export function ChartAnalyzer({ signedIn }: { signedIn: boolean }) {
  const [image, setImage] = useState('');
  const [sym, setSym] = useState('XAUUSD');
  const [tf, setTf] = useState<TF>('1h');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function take(file: File | null | undefined) {
    if (!file) return;
    setErr('');
    setRes(null);
    try {
      setImage(await shrink(file));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const f = Array.from(ev.clipboardData?.files || []).find((x) => x.type.startsWith('image/'));
      if (f) take(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  async function analyse() {
    if (!image) return setErr('Add a screenshot of your chart first.');
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      const r = await fetch('/api/chart-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, symbol: sym, tf, question }) });
      const d = await r.json().catch(() => null);
      if (!d) throw new Error(r.status === 504 || r.status === 524 ? 'The analysis took too long. Please try again, or pick a higher timeframe.' : r.status === 413 ? 'That screenshot is too large. Please crop it and try again.' : `The chart could not be analysed (error ${r.status}). Please try again.`);
      if (!r.ok || !d.ok) throw new Error(`${d.error || 'The chart could not be analysed.'}${d.detail ? ` (Reason: ${d.detail})` : ''}`);
      setRes(d as Result);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const a = res?.analysis;
  const b = res?.brain;
  const List = ({ items }: { items: string[] }) => (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, lineHeight: 1.5 }}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
  );

  return (
    <div className="stack" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 34, padding: 'clamp(22px, 4vw, 48px)', gap: 28 }}>
      <div className="stack" style={{ gap: 12, maxWidth: 860 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}><h2 className="h2">Chart Analysis</h2><span className="chip chip-amber">Beta</span></div>
        <p className="lead" style={{ margin: 0 }}>Upload a screenshot of your chart. We read what you drew, check the real price data top-down (the bigger timeframe first), find the zones where several reasons line up, weigh the evidence, add the news and interest-rate picture, and lay out the scenarios with reward to risk. Education, not financial advice.</p>
      </div>

      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>1 · Your chart</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => { ev.preventDefault(); take(ev.dataTransfer.files?.[0]); }}
            className="inset"
            style={{ minHeight: 220, borderRadius: 20, border: '2px dashed var(--line)', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 12, background: 'var(--inset)', color: 'var(--ink)' }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Your chart screenshot" style={{ maxWidth: '100%', maxHeight: 340, borderRadius: 12 }} />
            ) : (
              <span style={{ textAlign: 'center' }}><strong>Tap to add a screenshot</strong><br /><span className="muted">or drag it here, or paste it (Ctrl/Cmd + V)</span></span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(ev) => take(ev.target.files?.[0])} />
          {image && <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => { setImage(''); setRes(null); }}>Remove screenshot</button>}
        </div>
        <div className="stack" style={{ flex: '1 1 320px', minWidth: 0, gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>2 · Tell us what it is</span>
          <label className="field">Market on the chart<select className="input select" value={sym} onChange={(ev) => setSym(ev.target.value)}>{SYMBOLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label className="field">Timeframe<select className="input select" value={tf} onChange={(ev) => setTf(ev.target.value as TF)}>{TIMEFRAMES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
          <label className="field">Your question (optional)<input className="input" maxLength={300} placeholder="e.g. Is my demand zone still valid?" value={question} onChange={(ev) => setQuestion(ev.target.value)} /></label>
          <button type="button" className="btn" onClick={analyse} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? <span className="spinner" aria-label="Analysing" /> : 'Analyse my chart'} <span className="arr" aria-hidden="true">»</span>
          </button>
          <span className="faint" style={{ fontSize: 14 }}>Free without an account, a few charts a day. {signedIn ? '' : 'A free account gives you more.'} We do not keep your screenshot.</span>
        </div>
      </div>

      {err && <div role="alert" className="note note-bad">{err}</div>}
      {busy && <div role="status" className="note note-info">Reading your chart and checking real {SYMBOLS.find((s) => s.key === sym)?.label} price data and the news… this can take up to 30 seconds.</div>}

      {res && a && b && (
        <div className="stack" style={{ gap: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>{res.market} · {res.timeframe}</span>
            <span className="faint" style={{ fontSize: 14 }}>Last closed candle {res.structure.lastTime} at {res.structure.lastClose} · ATR {b.atr} ({b.atrPips} pips)</span>
          </div>
          {res.ai === false && <div className="note note-warn"><strong>We could not read your screenshot just now,</strong> so this analysis comes from the real {res.market} price data and the news only.{res.aiNote ? <span style={{ display: 'block', fontSize: 13, marginTop: 4, opacity: 0.8 }}>Reason: {res.aiNote}</span> : null}</div>}
          {!a.matches && <div className="note note-warn"><strong>Check your choice:</strong> {a.mismatch || 'the screenshot may not be the market or timeframe you picked, so the levels below may not match your chart.'}</div>}

          <div className="card stack" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 22 }}>The big picture</h3>
              <span className="chip" style={{ background: BIAS_STYLE[b.evidence.lean].bg, color: BIAS_STYLE[b.evidence.lean].fg }}>Evidence: {b.evidence.lean}</span>
            </div>
            {a.story && <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>{a.story}</p>}
            <EvidenceMeter bullish={b.evidence.bullish} bearish={b.evidence.bearish} />
            <span className="muted" style={{ fontSize: 15 }}>{b.evidence.summary}{a.leaning ? ` ${a.leaning}` : ''}</span>
          </div>

          {a.answer && <div className="card" style={{ background: 'var(--blue-soft)' }}><strong>Your question:</strong> {a.answer}</div>}

          <div className="stack" style={{ gap: 8 }}>
            <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Real price chart with the key zones</h3>
            <ZoneChart candles={b.chart} zones={b.zones} plan={b.plans.find((p) => p.leans) || null} digits={res.digits} />
            <span className="faint" style={{ fontSize: 13 }}>Red lines: resistance (R). Green lines: support (S). Thicker lines are stronger zones. Dotted lines: the favoured plan.</span>
          </div>

          <div className="grid g-2">
            {b.plans.map((p) => <PlanCard key={p.id} p={p} note={a.planNotes[p.id]} />)}
          </div>

          <div className="grid g-2">
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Evidence checklist</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                {b.checks.map((c) => (
                  <li key={c.label} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, lineHeight: 1.45 }}>
                    <span aria-label={LEAN_ICON[c.lean].word} style={{ color: LEAN_ICON[c.lean].colour, fontWeight: 800 }}>{LEAN_ICON[c.lean].icon}</span>
                    <span><strong>{c.label}:</strong> {c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Key zones</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                {b.zones.map((z) => (
                  <li key={z.id} style={{ lineHeight: 1.45 }}>
                    <strong style={{ color: z.side === 'resistance' ? '#B23C12' : '#0B7A45' }}>{z.id}</strong> {z.low} to {z.high}
                    <span className="faint" style={{ fontSize: 13 }}> · strength {'●'.repeat(Math.min(5, z.score))}{'○'.repeat(Math.max(0, 5 - z.score))} · {z.distanceAtr} ATR away</span>
                    <span style={{ display: 'block', fontSize: 14 }} className="muted">{z.reasons.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Fundamental backing</h3>
              {a.fundamentalStory && <p style={{ margin: 0, lineHeight: 1.55 }}>{a.fundamentalStory}</p>}
              {b.rateGap && <span><strong>Rate gap:</strong> {b.rateGap.base} {b.rateGap.baseRate}% vs {b.rateGap.quote} {b.rateGap.quoteRate}% ({b.rateGap.gap > 0 ? '+' : ''}{b.rateGap.gap})</span>}
              <List items={a.fundamentals.length ? a.fundamentals : ['No major scheduled news in our data for this market this week.']} />
              <Link href="/markets" style={{ fontSize: 15 }}>See all events and rates »</Link>
            </div>
            {(a.seen.length > 0 || a.drawings.length > 0) && (
              <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
                <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Your chart</h3>
                {a.seen.length > 0 && <List items={a.seen} />}
                {a.drawings.length > 0 && <><strong style={{ fontSize: 16 }}>Your drawings vs the real zones</strong><List items={a.drawings} /></>}
              </div>
            )}
            {a.structure.length > 0 && (
              <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
                <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Structure</h3>
                <span className="muted">{res.structure.structure} · RSI {res.structure.rsi14}{b.htf ? ` · ${b.htf.label} trend ${b.htf.bias}` : ''}</span>
                <List items={a.structure} />
              </div>
            )}
            {a.mistakes.length > 0 && (
              <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
                <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Mistakes to avoid here</h3>
                <List items={a.mistakes} />
              </div>
            )}
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>What to watch next</h3>
              <List items={a.watch.length ? a.watch : ['A candle close outside the nearest zones.']} />
            </div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            {a.caution ? `${a.caution} ` : ''}Every price above comes from real market data, not from your screenshot. This is an educational review of possible scenarios, not financial advice or a signal. Always use a stop loss and size your trade with the <Link href="/tools?tool=risk">Risk Calculator</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
