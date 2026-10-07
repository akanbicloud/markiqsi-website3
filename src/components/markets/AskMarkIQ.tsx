'use client';

import Link from 'next/link';
import { useState } from 'react';

const ASSETS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'Gold', 'Oil', 'Bitcoin', 'S&P 500'];

type Answer = { simply: string; drivers: { t: string; x: string }[]; latest: string[]; history: string[]; watch: string[]; missing: string };

export function AskMarkIQ({ signedIn }: { signedIn: boolean }) {
  const [asset, setAsset] = useState('EUR/USD');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ asset: string; answer: Answer; sources: string[]; remaining: number } | null>(null);

  async function ask() {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ asset, question }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
      setRes(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{title}</span>
        {items.map((x) => (
          <div key={x} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 8, height: 8, borderRadius: '50%', background: '#1A5FD0', marginTop: 9 }} />
            <span style={{ color: '#3A4A66' }}>{x}</span>
          </div>
        ))}
      </div>
    );

  return (
    <section id="ask" aria-labelledby="ask-h" className="wrap" style={{ padding: '30px 16px 20px', scrollMarginTop: 20 }}>
      <div className="row" style={{ background: 'linear-gradient(140deg, #1A5FD0, #0D2350)', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(28px, 4vw, 52px)', gap: 36 }}>
        <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 18 }}>
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <h2 id="ask-h" className="h2">Ask MarkIQ</h2>
            <span className="chip chip-amber">Beta</span>
          </div>
          <p style={{ margin: 0, fontSize: 19, color: '#D5E3FF' }}>
            Ask about any currency pair or asset and get the full story in plain words: what drives its price, the latest official numbers, the events coming up, and how it has reacted to the same news over past years. Every answer shows its sources.
          </p>
          <span style={{ fontWeight: 600 }}>Pick one:</span>
          <div className="row" style={{ gap: 8 }} role="group" aria-label="Asset">
            {ASSETS.map((a) => (
              <button key={a} type="button" aria-pressed={asset === a} onClick={() => setAsset(a)} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, fontWeight: 600, cursor: 'pointer', ...(asset === a ? { background: '#FFFFFF', color: '#0B1A36', border: '1px solid #FFFFFF' } : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.45)' }) }}>
                {a}
              </button>
            ))}
          </div>
          <label htmlFor="ask-q" style={{ fontWeight: 600 }}>Your question (optional)</label>
          <textarea id="ask-q" rows={3} value={question} maxLength={400} onChange={(e) => setQuestion(e.target.value)} placeholder={`e.g. What is moving ${asset} this week?`} style={{ width: '100%', borderRadius: 18, border: 'none', padding: '16px 18px', fontSize: 17, color: '#0B1A36', background: '#FFFFFF', resize: 'vertical' }} />
          <button type="button" onClick={ask} disabled={busy} className="btn btn-amber" style={{ alignSelf: 'flex-start' }}>
            {busy ? <span className="spinner" aria-label="Thinking" /> : 'Ask MarkIQ'} <span className="arr" aria-hidden="true">»</span>
          </button>
          <span className="small" style={{ color: '#B9C9E6' }}>
            {signedIn ? '20 questions a day with your account.' : <>3 free questions a day. <Link href="/get-started" style={{ color: '#FFB547' }}>Create a free account</Link> for more.</>} MarkIQ only answers from real data; if it does not have the facts, it says so. Not financial advice.
          </span>
        </div>
        <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex' }}>
          {res ? (
            <article aria-live="polite" className="stack" style={{ flex: 1, background: '#FFFFFF', color: '#0B1A36', borderRadius: 26, padding: 28, gap: 16 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 28 }}>{res.asset}</span>
              <div style={{ background: '#EAF1FF', borderRadius: 16, padding: '14px 16px', fontSize: 18 }}>
                <strong style={{ color: '#1A5FD0' }}>Simply:</strong> {res.answer.simply}
              </div>
              {res.answer.drivers.length > 0 && (
                <div className="stack" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 17 }}>What moves it</span>
                  {res.answer.drivers.map((d) => (
                    <div key={d.t} className="stack" style={{ gap: 2, padding: '12px 14px', background: '#F6F1E9', borderRadius: 14 }}>
                      <span style={{ fontWeight: 700 }}>{d.t}</span>
                      <span style={{ color: '#3A4A66', fontSize: 16 }}>{d.x}</span>
                    </div>
                  ))}
                </div>
              )}
              {list('Latest official numbers', res.answer.latest)}
              {list('How it reacted before', res.answer.history)}
              {list('Coming up', res.answer.watch)}
              {res.answer.missing && <div style={{ background: '#FFF1D6', color: '#6B3E00', borderRadius: 14, padding: '10px 14px', fontSize: 15 }}>{res.answer.missing}</div>}
              <span className="mono" style={{ fontSize: 13, color: '#5A6780' }}>Sources: {res.sources.join(', ')}</span>
            </article>
          ) : (
            <div className="stack center" style={{ flex: 1, border: '2px dashed rgba(255,255,255,0.35)', borderRadius: 26, padding: 28, justifyContent: 'center', textAlign: 'center', fontSize: 18, color: '#D5E3FF', gap: 12 }}>
              {err ? <div role="alert" style={{ background: '#FFE1D5', color: '#7A2508', borderRadius: 14, padding: '12px 16px' }}>{err}</div> : 'Pick a pair or asset and press Ask MarkIQ.'}
            </div>
          )}
        </div>
      </div>
      {res && err && <div role="alert" className="note note-bad" style={{ marginTop: 12 }}>{err}</div>}
    </section>
  );
}
