'use client';

import Link from 'next/link';
import { useState } from 'react';

type U = { name: string; email: string; goal: string; level: string; markets: string[]; telegram: boolean; telegramUser: string };
const MARKETS = ['Forex', 'Gold & Oil', 'Indices', 'Stocks', 'Crypto'];
const LEVELS = [['new', 'Completely new'], ['some', 'Some experience'], ['pro', 'Experienced']];

export function AccountPanel({ user, telegramReady }: { user: U; telegramReady: boolean }) {
  const [name, setName] = useState(user.name);
  const [level, setLevel] = useState(user.level);
  const [markets, setMarkets] = useState<string[]>(user.markets);
  const [msg, setMsg] = useState('');
  const [tg, setTg] = useState(user.telegram);
  const [tgUrl, setTgUrl] = useState('');
  const [tgErr, setTgErr] = useState('');

  async function save() {
    setMsg('');
    const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level, markets, goal: user.goal }) });
    setMsg(r.ok ? 'Saved.' : 'Could not save. Please try again.');
  }
  async function connect() {
    setTgErr('');
    const r = await fetch('/api/telegram/link', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return setTgErr(d.error || 'Could not create a link. Please try again.');
    setTgUrl(d.url);
    window.open(d.url, '_blank', 'noopener');
  }
  async function disconnect() {
    await fetch('/api/telegram/link', { method: 'DELETE' });
    setTg(false);
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <section className="wrap stack" style={{ padding: '60px 16px 120px', gap: 22 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">My account</span>
          <h1 className="h2">Hi, {user.name.split(' ')[0] || 'trader'}</h1>
          <span className="muted">{user.email}</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={logout}>Log out</button>
      </div>

      <div className="grid g-4" style={{ gap: 16 }}>
        {[
          ['Markets', 'This week’s events, rates and news', '/markets'],
          ['Market Scanner', 'Find setups and set alerts', '/tools?tool=scan'],
          ['Bot Builder', 'Build and test your bots', '/tools?tool=bot'],
          ['Trading Journal', 'Log trades, see your calendar', '/tools?tool=journal'],
        ].map(([t, x, h]) => (
          <Link key={t} href={h} className="card lift stack" style={{ gap: 6, textDecoration: 'none', color: 'var(--ink)' }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{t}</span>
            <span className="muted">{x}</span>
            <span style={{ marginTop: 8, fontWeight: 600, color: 'var(--blue)' }}>Open »</span>
          </Link>
        ))}
      </div>

      <div id="telegram" className="card-lg stack on-navy" style={{ background: '#0B1A36', color: '#FFFFFF', gap: 14, scrollMarginTop: 20 }}>
        <span className="eyebrow">Telegram alerts</span>
        {tg ? (
          <>
            <h2 className="h3">Telegram is connected{user.telegramUser ? ` (@${user.telegramUser})` : ''}</h2>
            <p className="muted" style={{ margin: 0 }}>You will get market alerts, event reminders and scanner alerts on Telegram.</p>
            <button type="button" className="btn btn-ghost-light btn-sm" style={{ alignSelf: 'flex-start' }} onClick={disconnect}>Disconnect Telegram</button>
          </>
        ) : (
          <>
            <h2 className="h3">Connect Telegram in one tap</h2>
            <p className="muted" style={{ margin: 0 }}>Press the button, then press <strong style={{ color: '#FFFFFF' }}>Start</strong> in Telegram. Come back here and refresh the page to see it connected.</p>
            {telegramReady ? (
              <button type="button" className="btn btn-amber" style={{ alignSelf: 'flex-start' }} onClick={connect}>Connect Telegram <span className="arr" aria-hidden="true">»</span></button>
            ) : (
              <div className="note note-warn">Telegram connection is being set up. Please check back soon.</div>
            )}
            {tgUrl && <p className="small" style={{ margin: 0, color: '#B9C9E6' }}>Telegram did not open? <a href={tgUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FFB547' }}>Open this link</a>. It works for 30 minutes.</p>}
            {tgErr && <div role="alert" className="note note-bad">{tgErr}</div>}
          </>
        )}
      </div>

      <div className="card-lg stack" style={{ gap: 20 }}>
        <h2 className="h3">Your details</h2>
        <div className="field" style={{ maxWidth: 480 }}>
          <label htmlFor="acc-name">Name</label>
          <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Trading experience</span>
          <div className="row" style={{ gap: 8 }}>
            {LEVELS.map(([k, l]) => (
              <button key={k} type="button" className="toggle" aria-pressed={level === k} onClick={() => setLevel(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <span className="label">Markets you follow</span>
          <div className="row" style={{ gap: 8 }}>
            {MARKETS.map((m) => (
              <button key={m} type="button" className="toggle" aria-pressed={markets.includes(m)} onClick={() => setMarkets(markets.includes(m) ? markets.filter((x) => x !== m) : [...markets, m])}>{m}</button>
            ))}
          </div>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          <button type="button" className="btn btn-sm" onClick={save}>Save changes</button>
          {msg && <span role="status" className="muted">{msg}</span>}
        </div>
        <p className="faint small" style={{ margin: 0 }}>Want to delete your account and data? Email markiqsi2@gmail.com from this email address.</p>
      </div>
    </section>
  );
}
