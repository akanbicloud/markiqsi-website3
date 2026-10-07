'use client';

import Link from 'next/link';
import { useState } from 'react';

const GOALS = [
  { key: 'learn', title: 'Learn to trade', text: 'Start with the lessons', href: '/#learn', go: 'Start learning' },
  { key: 'alerts', title: 'Get market alerts', text: 'See this week’s big events', href: '/markets', go: 'Go to Markets' },
  { key: 'build', title: 'Build a trading bot', text: 'Open the Bot Builder', href: '/tools?tool=bot', go: 'Open the Bot Builder' },
];
const LEVELS = [['new', 'Completely new'], ['some', 'Some experience'], ['pro', 'Experienced']];
const MARKETS = ['Forex', 'Gold & Oil', 'Indices', 'Stocks', 'Crypto'];

export function Onboarding({ firstName }: { firstName: string }) {
  const [goal, setGoal] = useState('learn');
  const [level, setLevel] = useState('new');
  const [markets, setMarkets] = useState<string[]>(['Forex']);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const g = GOALS.find((x) => x.key === goal)!;

  async function save(skip: boolean) {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(skip ? {} : { goal, level, markets }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save. Please try again.');
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap" style={{ padding: '60px 16px 120px', maxWidth: 1000 }}>
      <div className="card-lg stack" style={{ gap: 24 }}>
        <div className="row" style={{ gap: 8 }} aria-label="Progress">
          {['1 · Account', '2 · Confirm email', '3 · Set up'].map((s) => (
            <span key={s} className="chip" style={{ background: 'var(--ink)', color: 'var(--bg)', padding: '6px 14px', fontSize: 14 }}>{s}</span>
          ))}
        </div>
        {!done ? (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <span className="chip chip-mint" style={{ alignSelf: 'flex-start', padding: '6px 16px', fontSize: 14 }}>Account created</span>
              <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(34px, 4.2vw, 54px)', lineHeight: 1.04 }}>Welcome, {firstName}. Let&apos;s set things up.</h1>
              <p className="muted" style={{ margin: 0, fontSize: 18 }}>Three quick questions so we can show you the right things first. You can change these any time.</p>
            </div>
            <fieldset className="stack" style={{ gap: 10, border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ fontSize: 18, marginBottom: 10 }}>1. What do you want to do first?</legend>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                {GOALS.map((x) => {
                  const on = goal === x.key;
                  return (
                    <button key={x.key} type="button" aria-pressed={on} onClick={() => setGoal(x.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left', minHeight: 96, padding: '16px 18px', borderRadius: 18, cursor: 'pointer', background: on ? 'var(--ink)' : 'var(--inset)', color: on ? 'var(--bg)' : 'var(--ink)', border: `2px solid ${on ? 'var(--ink)' : 'var(--inset)'}` }}>
                      <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>{x.title}</span>
                      <span style={{ fontSize: 15, opacity: 0.8 }}>{x.text}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="stack" style={{ gap: 10, border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ fontSize: 18, marginBottom: 10 }}>2. Your trading experience</legend>
              <div className="row" style={{ gap: 8 }}>
                {LEVELS.map(([k, l]) => (
                  <button key={k} type="button" className="toggle" aria-pressed={level === k} onClick={() => setLevel(k)}>{l}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="stack" style={{ gap: 10, border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ fontSize: 18, marginBottom: 10 }}>3. Markets you follow <span className="faint" style={{ fontWeight: 500, fontSize: 15 }}>(pick any)</span></legend>
              <div className="row" style={{ gap: 8 }}>
                {MARKETS.map((m) => (
                  <button key={m} type="button" className="toggle" aria-pressed={markets.includes(m)} onClick={() => setMarkets(markets.includes(m) ? markets.filter((x) => x !== m) : [...markets, m])}>{m}</button>
                ))}
              </div>
            </fieldset>
            {err && <div role="alert" className="note note-bad">{err}</div>}
            <div className="row" style={{ alignItems: 'center', gap: 18 }}>
              <button type="button" className="btn" disabled={busy} onClick={() => save(false)} style={{ minHeight: 64, fontSize: 20 }}>Continue <span className="arr" aria-hidden="true">»</span></button>
              <button type="button" className="linkbtn" disabled={busy} onClick={() => save(true)} style={{ color: 'var(--muted)', fontSize: 17 }}>Skip for now</button>
            </div>
          </>
        ) : (
          <div className="stack" style={{ gap: 18, maxWidth: 640 }}>
            <span className="chip chip-mint" style={{ alignSelf: 'flex-start', padding: '6px 16px', fontSize: 14 }}>All set</span>
            <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(36px, 4.4vw, 58px)', lineHeight: 1.02 }}>You&apos;re all set, {firstName}.</h1>
            <p style={{ margin: 0, fontSize: 19, color: 'var(--text)' }}>Your account is ready. Connect Telegram to get market alerts on your phone, or jump straight in.</p>
            <div className="row" style={{ gap: 12 }}>
              <Link href={g.href} className="btn" style={{ minHeight: 64, fontSize: 20 }}>{g.go} <span className="arr" aria-hidden="true">»</span></Link>
              <Link href="/account#telegram" className="btn btn-outline" style={{ minHeight: 64 }}>Connect Telegram</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
