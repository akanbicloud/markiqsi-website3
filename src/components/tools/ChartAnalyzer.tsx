'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SYMBOLS, TIMEFRAMES, type TF } from '@/lib/trading/symbols';

type Scenario = { bias: 'Bullish' | 'Bearish' | 'Neutral'; when: string; invalidation: string; watchFor: string };
type Result = {
  market: string;
  timeframe: string;
  structure: { lastClose: number; lastTime: string; trend: { bias: string }; structure: string; support: number[]; resistance: number[]; rsi14: number };
  analysis: { seen: string[]; matches: boolean; mismatch: string; structure: string[]; levels: { support: string[]; resistance: string[] }; fundamentals: string[]; scenarios: Scenario[]; leaning: string; watch: string[]; caution: string };
  remaining: number;
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

const BIAS_STYLE: Record<Scenario['bias'], { bg: string; fg: string }> = {
  Bullish: { bg: 'var(--mint-soft)', fg: '#0B4A2E' },
  Bearish: { bg: 'var(--coral-soft)', fg: '#7A2508' },
  Neutral: { bg: 'var(--blue-soft)', fg: 'var(--ink)' },
};

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
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'The chart could not be analysed.');
      setRes(d as Result);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const a = res?.analysis;
  const List = ({ items }: { items: string[] }) => (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, lineHeight: 1.5 }}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
  );

  return (
    <div className="stack" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 34, padding: 'clamp(22px, 4vw, 48px)', gap: 28 }}>
      <div className="stack" style={{ gap: 12, maxWidth: 860 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}><h2 className="h2">Chart Analysis</h2><span className="chip chip-amber">Beta</span></div>
        <p className="lead" style={{ margin: 0 }}>Upload a screenshot of your chart. We read what you drew, check the real price data for structure and key levels, add the news and interest-rate picture, and show you the possible scenarios. Education, not financial advice.</p>
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

      {res && a && (
        <div className="stack" style={{ gap: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>{res.market} · {res.timeframe}</span>
            <span className="faint" style={{ fontSize: 14 }}>Last closed candle {res.structure.lastTime} at {res.structure.lastClose}</span>
          </div>
          {!a.matches && <div className="note note-warn"><strong>Check your choice:</strong> {a.mismatch || 'the screenshot may not be the market or timeframe you picked, so the levels below may not match your chart.'}</div>}
          {a.leaning && <div className="card" style={{ fontSize: 18, lineHeight: 1.5 }}><strong>Where the evidence leans:</strong> {a.leaning}</div>}

          <div className="grid g-2">
            {a.scenarios.map((s, i) => (
              <div key={i} className="card stack" style={{ gap: 8, background: BIAS_STYLE[s.bias].bg, color: BIAS_STYLE[s.bias].fg, borderColor: 'transparent' }}>
                <strong style={{ fontSize: 20 }}>{s.bias} scenario</strong>
                <span><strong>If:</strong> {s.when}</span>
                <span><strong>Wrong if:</strong> {s.invalidation}</span>
                {s.watchFor && <span><strong>Watch for:</strong> {s.watchFor}</span>}
              </div>
            ))}
          </div>

          <div className="grid g-2">
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Structure (from real price data)</h3>
              <span className="muted">{res.structure.structure} · trend {res.structure.trend.bias} · RSI {res.structure.rsi14}</span>
              <List items={a.structure} />
              <div className="row" style={{ gap: 18, marginTop: 4 }}>
                <span><strong>Resistance:</strong> {res.structure.resistance.join(', ') || 'none nearby'}</span>
                <span><strong>Support:</strong> {res.structure.support.join(', ') || 'none nearby'}</span>
              </div>
            </div>
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>Fundamental backing</h3>
              <List items={a.fundamentals.length ? a.fundamentals : ['No major scheduled news in our data for this market this week.']} />
              <Link href="/markets" style={{ fontSize: 15 }}>See all events and rates »</Link>
            </div>
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>What we see on your chart</h3>
              <List items={a.seen} />
            </div>
            <div className="card stack" style={{ gap: 10, background: 'var(--inset)' }}>
              <h3 className="h3" style={{ margin: 0, fontSize: 21 }}>What to watch next</h3>
              <List items={a.watch} />
            </div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 15 }}>
            {a.caution ? `${a.caution} ` : ''}This is an educational review of possible scenarios, not financial advice or a signal. Prices can do something none of these scenarios describe. Always use a stop loss and size your trade with the <Link href="/tools?tool=risk">Risk Calculator</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
