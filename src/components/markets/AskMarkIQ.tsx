'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';

const FOCUS = ['Any', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'Gold', 'Oil', 'Bitcoin', 'S&P 500'];
const STARTERS = [
  'What is moving gold this week?',
  'What is a pip, and how do I work out my lot size?',
  'When is the next US inflation report and why does it matter?',
  'Which MarkIQ SI course should a beginner take, and how much is it?',
];

type Answer = { answer: string; facts: string[]; watch: string[]; followUps: string[]; topic: string; missing: string; assets: string[]; sources: string[] };
type Turn = { q: string; a: Answer };

/** Tiny formatter: paragraphs, "- " bullets and **bold**. Text only, never HTML. */
function Rich({ text }: { text: string }) {
  const bold = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { blocks.push({ list: false, lines: [] }); continue; }
    const isItem = /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    const content = isItem ? line.replace(/^([-•*]|\d+[.)])\s+/, '') : line;
    if (last && last.list === isItem && last.lines.length) last.lines.push(content);
    else blocks.push({ list: isItem, lines: [content] });
  }
  return (
    <>
      {blocks.filter((b) => b.lines.length).map((b, i) => b.list
        ? <ul key={i} style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>{b.lines.map((l, j) => <li key={j}>{bold(l)}</li>)}</ul>
        : <p key={i} style={{ margin: 0 }}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && ' '}{bold(l)}</Fragment>)}</p>)}
    </>
  );
}

export function AskMarkIQ({ signedIn }: { signedIn: boolean }) {
  const [focus, setFocus] = useState('Any');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (turns.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns.length]);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (q.length < 2) return setErr('Type a question first.');
    setBusy(true);
    setErr('');
    try {
      const history = turns.slice(-3).map((t) => ({ q: t.q, a: t.a.answer }));
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, asset: focus === 'Any' ? '' : focus, history }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
      setTurns((t) => [...t, { q, a: d.answer }]);
      setRemaining(typeof d.remaining === 'number' ? d.remaining : null);
      setQuestion('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="stack" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4, color: '#3A4A66', fontSize: 16 }}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    );

  return (
    <section id="ask" aria-labelledby="ask-h" className="wrap" style={{ padding: '30px 16px 20px', scrollMarginTop: 20 }}>
      <div className="row" style={{ background: 'linear-gradient(140deg, #1A5FD0, #0D2350)', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(22px, 4vw, 52px)', gap: 36, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 16 }}>
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <h2 id="ask-h" className="h2">Ask MarkIQ</h2>
            <span className="chip chip-amber">Beta</span>
          </div>
          <p style={{ margin: 0, fontSize: 19, color: '#D5E3FF' }}>
            Ask anything about trading: a market, the news, a strategy, a word you do not understand, or our courses. Live prices, rates, results and events come only from our data, with dates and sources. Same answers as our Telegram bot.
          </p>
          <label htmlFor="ask-q" style={{ fontWeight: 600 }}>Your question</label>
          <textarea
            id="ask-q" rows={3} value={question} maxLength={400}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) ask(); } }}
            placeholder={turns.length ? 'Ask a follow-up…' : 'e.g. Why did gold fall today?'}
            style={{ width: '100%', borderRadius: 18, border: 'none', padding: '16px 18px', fontSize: 17, color: '#0B1A36', background: '#FFFFFF', resize: 'vertical' }}
          />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Focus on a market (optional)</span>
          <div className="row" style={{ gap: 8 }} role="group" aria-label="Focus market">
            {FOCUS.map((a) => (
              <button key={a} type="button" aria-pressed={focus === a} onClick={() => setFocus(a)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, fontWeight: 600, fontSize: 15, cursor: 'pointer', ...(focus === a ? { background: '#FFFFFF', color: '#0B1A36', border: '1px solid #FFFFFF' } : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.45)' }) }}>
                {a}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <button type="button" onClick={() => ask()} disabled={busy} className="btn btn-amber">
              {busy ? <span className="spinner" aria-label="Thinking" /> : 'Ask MarkIQ'} <span className="arr" aria-hidden="true">»</span>
            </button>
            {turns.length > 0 && <button type="button" className="linkbtn" style={{ color: '#FFFFFF' }} onClick={() => { setTurns([]); setErr(''); }}>New conversation</button>}
          </div>
          <span className="small" style={{ color: '#B9C9E6' }}>
            {signedIn ? '20 questions a day with your account.' : <>3 free questions a day. <Link href="/get-started" style={{ color: '#FFB547' }}>Create a free account</Link> for more.</>}
            {remaining != null ? ` ${remaining} left today.` : ''} Education, not financial advice.
          </span>
        </div>

        <div className="stack" style={{ flex: '1 1 460px', minWidth: 0, gap: 14 }}>
          {turns.length === 0 && (
            <div className="stack" style={{ border: '2px dashed rgba(255,255,255,0.35)', borderRadius: 26, padding: 24, gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Try one of these</span>
              {STARTERS.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => ask(s)} style={{ textAlign: 'left', minHeight: 44, padding: '10px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', fontSize: 16, cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <article key={i} aria-live={i === turns.length - 1 ? 'polite' : undefined} className="stack" style={{ background: '#FFFFFF', color: '#0B1A36', borderRadius: 26, padding: 'clamp(18px, 3vw, 28px)', gap: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: '#1A5FD0' }}>{t.q}</span>
              <div className="stack" style={{ gap: 10, fontSize: 17, lineHeight: 1.6 }}><Rich text={t.a.answer} /></div>
              {list('Live facts we used', t.a.facts)}
              {list('Coming up', t.a.watch)}
              {t.a.missing && <div style={{ background: '#FFF1D6', color: '#6B3E00', borderRadius: 14, padding: '10px 14px', fontSize: 15 }}>{t.a.missing}</div>}
              {t.a.sources.length > 0 && <span className="mono" style={{ fontSize: 13, color: '#5A6780' }}>Sources: {t.a.sources.join(', ')}</span>}
              {i === turns.length - 1 && t.a.followUps.length > 0 && (
                <div className="row" style={{ gap: 8 }}>
                  {t.a.followUps.map((f) => (
                    <button key={f} type="button" disabled={busy} onClick={() => ask(f)} style={{ minHeight: 40, padding: '6px 14px', borderRadius: 999, border: '1px solid #C9D6EE', background: '#EAF1FF', color: '#0B1A36', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>{f}</button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {err && <div role="alert" style={{ background: '#FFE1D5', color: '#7A2508', borderRadius: 14, padding: '12px 16px' }}>{err}</div>}
          <div ref={endRef} />
        </div>
      </div>
    </section>
  );
}
