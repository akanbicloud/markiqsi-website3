'use client';

import Link from 'next/link';
import { useState } from 'react';

type Mode = 'signup' | 'login';

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (mode === 'signup' && !name.trim()) return setErr('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Please enter a valid email address.');
    if (mode === 'signup' && !agree) return setErr('Please tick the box to agree to the Terms and Privacy Policy.');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, name: name.trim(), email: email.trim(), agree }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
      setDevLink(d.devLink || '');
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const steps = mode === 'signup' ? ['1 · Account', '2 · Confirm email', '3 · Set up'] : [];
  const stepOn = sent ? 2 : 1;

  return (
    <section className="wrap" style={{ padding: '60px 16px 110px' }}>
      <div className="row" style={{ gap: 24, alignItems: 'stretch' }}>
        <div className="card-lg stack" style={{ flex: '1 1 560px', minWidth: 0, gap: 24 }}>
          {!sent && (
            <div role="tablist" aria-label="Account" className="tabs" style={{ alignSelf: 'flex-start', background: 'var(--inset)' }}>
              {(['signup', 'login'] as Mode[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className="toggle" style={{ minHeight: 48, padding: '0 24px', fontSize: 17 }} onClick={() => { setMode(m); setErr(''); }}>
                  {m === 'signup' ? 'Create account' : 'Log in'}
                </button>
              ))}
            </div>
          )}
          {steps.length > 0 && (
            <div className="row" style={{ gap: 8 }} aria-label="Progress">
              {steps.map((s, i) => (
                <span key={s} className="chip" style={i < stepOn ? { background: 'var(--ink)', color: 'var(--bg)', padding: '6px 14px', fontSize: 14 } : { padding: '6px 14px', fontSize: 14, color: 'var(--faint)' }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {!sent ? (
            <form onSubmit={submit} className="stack" style={{ gap: 22, maxWidth: 600 }} noValidate>
              <div className="stack" style={{ gap: 8 }}>
                <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(36px, 4.4vw, 58px)', lineHeight: 1.02 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
                <p className="muted" style={{ margin: 0, fontSize: 18 }}>
                  {mode === 'signup' ? 'No password needed. We email you a secure link to confirm your account.' : 'Enter your email and we will send you a secure link to log in. No password to remember.'}
                </p>
              </div>
              {mode === 'signup' && (
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Okafor" />
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              {mode === 'signup' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 16, color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: '#1A5FD0', flex: 'none' }} />
                  <span>
                    I agree to the <Link href="/terms">Terms of Use</Link> and <Link href="/privacy">Privacy Policy</Link>, and I understand MarkIQ SI provides education and information, not financial advice.
                  </span>
                </label>
              )}
              {err && <div role="alert" className="note note-bad">{err}</div>}
              <button type="submit" className="btn" disabled={busy} style={{ alignSelf: 'flex-start', minHeight: 64, padding: '0 36px', fontSize: 20 }}>
                {busy ? <span className="spinner" aria-label="Sending" /> : mode === 'signup' ? 'Create my account' : 'Email me a login link'} <span className="arr" aria-hidden="true">»</span>
              </button>
              <p className="muted" style={{ margin: 0 }}>
                {mode === 'signup' ? 'Already have an account? ' : 'New to MarkIQ SI? '}
                <button type="button" className="linkbtn" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(''); }}>
                  {mode === 'signup' ? 'Log in' : 'Create an account'}
                </button>
              </p>
            </form>
          ) : (
            <div aria-live="polite" className="stack" style={{ gap: 16, maxWidth: 620 }}>
              <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(36px, 4.4vw, 58px)', lineHeight: 1.02 }}>Check your email</h1>
              <p style={{ margin: 0, fontSize: 19, color: 'var(--text)' }}>
                We sent a secure link to <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>. Open it on this device to {mode === 'signup' ? 'confirm your account' : 'log in'}. The link works once and expires in 15 minutes.
              </p>
              {devLink && (
                <div className="note note-warn">
                  Test mode (email sending is not set up on this computer): <a href={devLink}>open the link</a>.
                </div>
              )}
              <p className="faint small" style={{ margin: 0 }}>
                No email after 2 minutes? Check your spam folder, or{' '}
                <button type="button" className="linkbtn" onClick={() => setSent(false)}>
                  try again
                </button>
                .
              </p>
            </div>
          )}
        </div>

        <aside className="stack on-navy" style={{ flex: '1 1 400px', minWidth: 0, background: '#0B1A36', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(26px, 4vw, 48px)', gap: 22 }}>
          <span className="eyebrow">With your account you can</span>
          {[
            ['Save your progress', 'Pick up every lesson exactly where you left off.'],
            ['Telegram market alerts', 'Alerts before and after big news, for the markets you choose.'],
            ['Scanner alerts', 'Get told when a new setup matches your strategies.'],
            ['More Ask MarkIQ questions', 'Ask about the fundamentals and history behind any asset.'],
            ['Your bots and journal', 'Save your strategies, bots and every trade you log.'],
          ].map(([t, x]) => (
            <div key={t} className="stack" style={{ gap: 4, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 21 }}>{t}</span>
              <span style={{ fontSize: 16, color: '#B9C9E6' }}>{x}</span>
            </div>
          ))}
          <div className="stack" style={{ marginTop: 'auto', background: '#FFB547', color: '#0B1A36', borderRadius: 22, padding: 20, gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Your security comes first</span>
            <span>We never ask for your trading or broker password. Your journal and strategies are private to you.</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
