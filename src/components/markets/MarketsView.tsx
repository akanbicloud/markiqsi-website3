'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { MarketData } from '@/lib/markets';
import { AskMarkIQ } from './AskMarkIQ';
import { ZONES, countdown, dayKey, dayLabel, fmtDate, fmtDay, fmtTime, openSessions } from './time';

const MARKETS = ['All', 'Forex', 'Crypto', 'Stocks', 'Commodities'];
const TOPICS = ['All', 'Geopolitics', 'Economy', 'Central banks', 'Commodities', 'Crypto'];

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function MarketsView({ data, signedIn, telegramUrl }: { data: MarketData; signedIn: boolean; telegramUrl: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [zone, setZone] = useState('WAT');
  const [day, setDay] = useState('');
  const [market, setMarket] = useState('All');
  const [country, setCountry] = useState('All');
  const [topic, setTopic] = useState('All');
  const [reminded, setReminded] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const z = localStorage.getItem('mq-zone');
      if (z && ZONES.some((x) => x.key === z)) setZone(z);
    } catch {}
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const Z = ZONES.find((z) => z.key === zone) || ZONES[0];
  const open = openSessions(now);

  const days = useMemo(() => {
    const keys = Array.from(new Set(data.events.map((e) => dayKey(e.scheduled_at, Z.tz)))).sort();
    const today = dayKey(now, Z.tz);
    return keys.filter((k) => k >= today);
  }, [data.events, Z.tz, now]);
  const activeDay = day && days.includes(day) ? day : days[0] || '';
  const countries = useMemo(() => ['All', ...Array.from(new Set(data.events.map((e) => e.country))).sort()], [data.events]);

  const events = data.events.filter(
    (e) => dayKey(e.scheduled_at, Z.tz) === activeDay && (market === 'All' || (e.markets || []).includes(market)) && (country === 'All' || e.country === country),
  );
  const news = data.news.filter((n) => topic === 'All' || n.category === topic);

  async function remind(id: string) {
    if (!signedIn) {
      window.location.href = '/get-started';
      return;
    }
    const r = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: id }) });
    const d = await r.json().catch(() => ({}));
    setReminded({ ...reminded, [id]: !r.ok ? 'error' : d.telegram ? 'ok' : 'notg' });
  }

  return (
    <>
      <section className="hero-band stack center" style={{ padding: '90px 16px 30px', textAlign: 'center' }}>
        <div className="stack center" style={{ maxWidth: 1100, gap: 22 }}>
          <h1 className="h1 rise">What&apos;s Moving the Market This Week</h1>
          <p className="lead rise d1" style={{ maxWidth: 820 }}>
            The big events and news from the US, UK, Europe, Japan, China, Canada and Australia, from economic data to wars, elections and trade, explained in plain words before and after they happen.
          </p>
          <div className="row rise d1" style={{ justifyContent: 'center', alignItems: 'center', gap: '10px 18px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 999, padding: '8px 18px' }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: open.length ? '#3DDC97' : '#C9C1B2' }} />
              <span style={{ fontWeight: 600 }} suppressHydrationWarning>{open.length ? `Open now: ${open.join(', ')}` : 'Main markets are closed right now'}</span>
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Show times in</span>
              <select
                className="select-pill"
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  try { localStorage.setItem('mq-zone', e.target.value); } catch {}
                }}
              >
                {ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section aria-labelledby="read-h" className="wrap" style={{ padding: '10px 16px 20px' }}>
        <div className="card stack" style={{ gap: 18, borderRadius: 30, padding: '28px 32px' }}>
          <h2 id="read-h" className="display" style={{ fontWeight: 700, fontSize: 26 }}>New here? Four words to know first</h2>
          <div className="grid g-4" style={{ gap: 14 }}>
            {[
              ['Expected', 'What experts thought the number would be before it came out.'],
              ['Actual', 'The real number, from the official source, the moment it is released.'],
              ['Surprise', 'How far the actual was from expected. A bigger surprise usually means a bigger move.'],
              ['Simply', 'One plain sentence on what it means. History shows what usually happens, never a promise.'],
            ].map(([t, x], i) => (
              <div key={t} className="inset stack" style={{ gap: 4 }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 20 }}><span style={{ color: 'var(--blue)' }}>{i + 1}.</span> {t}</span>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AskMarkIQ signedIn={signedIn} />

      <section aria-labelledby="events-h" className="wrap stack" style={{ padding: '50px 16px 30px', gap: 20 }}>
        <h2 id="events-h" className="h2">This week&apos;s big events</h2>
        {data.events.length === 0 ? (
          <Empty>{data.error || 'The calendar fills in automatically from official sources. No upcoming events are loaded yet. Please check back soon.'}</Empty>
        ) : (
          <>
            <div className="row" style={{ gap: 14, justifyContent: 'space-between', alignItems: 'center' }}>
              <div role="tablist" aria-label="Day" className="tabs">
                {days.map((d) => (
                  <button key={d} type="button" role="tab" aria-selected={d === activeDay} className="toggle" onClick={() => setDay(d)} suppressHydrationWarning>
                    {dayLabel(d, Z.tz, now)}
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Market</span>
                  <select className="select-pill" value={market} onChange={(e) => setMarket(e.target.value)}>
                    {MARKETS.map((m) => <option key={m} value={m}>{m === 'All' ? 'All markets' : m}</option>)}
                  </select>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Country</span>
                  <select className="select-pill" value={country} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map((c) => <option key={c} value={c}>{c === 'All' ? 'All countries' : c}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              {events.map((e) => (
                <article key={e.id} className="card lift row" style={{ borderRadius: 24, padding: '24px 28px', gap: '18px 32px', alignItems: 'center' }}>
                  <div className="stack" style={{ flex: '0 0 170px', gap: 2 }}>
                    <span className="mono" style={{ fontSize: 24, fontWeight: 500 }} suppressHydrationWarning>{fmtTime(e.scheduled_at, Z.tz)} {Z.short}</span>
                    <span className="mono faint" style={{ fontSize: 14 }} suppressHydrationWarning>{zone === 'GMT' ? `${fmtTime(e.scheduled_at, 'Africa/Lagos')} WAT` : `${fmtTime(e.scheduled_at, 'UTC')} GMT`}</span>
                    <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, marginTop: 4 }} suppressHydrationWarning>{countdown(e.scheduled_at, now)}</span>
                  </div>
                  <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 6 }}>
                    <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                      <span className="chip chip-blue">{e.country} · {e.currency}</span>
                      <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>{e.name}</span>
                      <span className={`chip ${e.impact === 'High' ? 'chip-high' : 'chip-med'}`}>{e.impact}</span>
                    </div>
                    {e.what && <span style={{ fontSize: 17, color: 'var(--text)' }}>{e.what}</span>}
                    {e.why && <span style={{ fontSize: 17 }}><strong>Why it matters:</strong> {e.why}</span>}
                    {(e.forecast || e.previous) && (
                      <span className="mono small faint">
                        {e.forecast ? `Expected ${e.forecast}` : ''}{e.forecast && e.previous ? ' · ' : ''}{e.previous ? `Last time ${e.previous}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="stack" style={{ flex: '0 1 230px', alignItems: 'flex-start', gap: 10 }}>
                    <div className="row" style={{ gap: 6 }}>{(e.markets || []).map((t) => <span key={t} className="chip">{t}</span>)}</div>
                    {reminded[e.id] === 'ok' ? (
                      <span className="chip chip-mint">Reminder set on Telegram</span>
                    ) : reminded[e.id] === 'notg' ? (
                      <span className="small">Reminder saved. <Link href="/account#telegram">Connect Telegram</Link> to receive it.</span>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 44, fontSize: 15 }} onClick={() => remind(e.id)}>
                        Remind me on Telegram <span aria-hidden="true">»</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {events.length === 0 && <Empty>No big events for this choice on this day. Try another day, market or country.</Empty>}
            </div>
          </>
        )}
        <span className="small faint">Only important events are shown. Numbers come from each country’s official statistics office and central bank, each labelled with its source.</span>
      </section>

      <section aria-labelledby="rates-h" className="wrap" style={{ padding: '40px 16px' }}>
        <div className="card-lg stack" style={{ gap: 20 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h2 id="rates-h" className="display" style={{ fontWeight: 700, fontSize: 'clamp(30px, 3.6vw, 46px)' }}>Interest rates around the world</h2>
            <span className="muted" style={{ fontSize: 17 }}>The most important number for any currency. Higher rates usually attract money and support that currency.</span>
          </div>
          {data.rates.length === 0 ? (
            <Empty>Central bank rates load automatically from each bank&apos;s official website. They are not loaded yet.</Empty>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 640, fontSize: 17 }}>
                <thead>
                  <tr><th>Central bank</th><th>Currency</th><th>Rate now</th><th>Last change</th><th>Next meeting</th></tr>
                </thead>
                <tbody>
                  {data.rates.map((r) => (
                    <tr key={r.bank}>
                      <td style={{ fontWeight: 700 }}>{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{r.bank}</a> : r.bank}</td>
                      <td>{r.currency}</td>
                      <td className="mono" style={{ fontSize: 19 }}>{r.rate}</td>
                      <td><span className={`chip ${/cut/i.test(r.last_change || '') ? 'chip-bull' : /rais|hike/i.test(r.last_change || '') ? 'chip-bear' : ''}`}>{r.last_change || 'Hold'}</span>{r.last_change_date && <span className="faint small"> {fmtDay(r.last_change_date)}</span>}</td>
                      <td className="mono">{fmtDay(r.next_meeting)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section style={{ background: '#0B1A36', color: '#FFFFFF', marginTop: 50 }}>
        <div className="wrap row" style={{ padding: '100px 16px', gap: 40 }}>
          <div className="stack" style={{ flex: '1 1 520px', minWidth: 0, gap: 22 }}>
            <h2 className="h2">Latest results</h2>
            {data.results.length === 0 && <div style={{ border: '2px dashed rgba(255,255,255,0.3)', borderRadius: 22, padding: 28, color: '#B9C9E6' }}>Results appear here the moment each official number is released.</div>}
            {data.results.map((r) => {
              const v = (r.verdict || '').toLowerCase();
              const cls = v.includes('higher') ? 'chip-high' : v.includes('lower') ? '' : 'chip';
              return (
                <article key={r.event_id} className="stack" style={{ background: '#FFFFFF', color: '#0B1A36', borderRadius: 22, padding: '20px 22px', gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="row" style={{ alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: '#EAF1FF', color: '#1A5FD0', fontSize: 12, fontWeight: 700 }}>{r.country}</span>
                      <span className="display" style={{ fontWeight: 700, fontSize: 21 }}>{r.name}</span>
                    </span>
                    {r.verdict && <span className={`chip ${cls}`} style={v.includes('lower') ? { background: '#1A5FD0', color: '#FFFFFF' } : v.includes('higher') ? {} : { background: '#F2EDE4', color: '#3A4A66' }}>{r.verdict}</span>}
                  </div>
                  <div className="row mono" style={{ gap: '8px 22px', fontSize: 15 }}>
                    <span>Actual <strong style={{ fontSize: 18 }}>{r.actual}</strong></span>
                    {r.forecast && <span style={{ color: '#4A5873' }}>Expected {r.forecast}</span>}
                    {r.previous && <span style={{ color: '#4A5873' }}>Last {r.previous}</span>}
                  </div>
                  {typeof r.surprise_score === 'number' && (
                    <div style={{ display: 'flex', gap: 4 }} aria-label={`Surprise level ${r.surprise_score} of 10`}>
                      {Array.from({ length: 10 }).map((_, i) => <span key={i} style={{ flex: 1, height: 10, borderRadius: 3, background: i < (r.surprise_score || 0) ? '#E0592A' : '#E8E1D4' }} />)}
                    </div>
                  )}
                  {r.simply && <span><strong style={{ color: '#1A5FD0' }}>Simply:</strong> {r.simply}</span>}
                  <span className="mono" style={{ fontSize: 12, color: '#5A6780' }} suppressHydrationWarning>
                    {fmtDate(r.released_at, Z.tz)} {Z.short} · Source: {r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer">{r.source}</a> : r.source}
                  </span>
                </article>
              );
            })}
          </div>
          <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 22 }}>
            <h2 className="h2">Live: central bank broadcasts</h2>
            {data.live?.is_live && data.live.youtube_id ? (
              <div className="stack" style={{ gap: 12 }}>
                <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 28, overflow: 'hidden', background: '#000' }}>
                  <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(data.live.youtube_id)}?autoplay=0`} title={data.live.title || 'Live broadcast'} allow="encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
                </div>
                {data.live.title && <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{data.live.title}</span>}
                {data.live.summary && <p style={{ margin: 0, color: '#DCE6F7' }}>{data.live.summary}</p>}
              </div>
            ) : (
              <div className="stack center" style={{ aspectRatio: '16 / 9', borderRadius: 28, background: 'linear-gradient(160deg, #123F86, #0D2350)', justifyContent: 'center', textAlign: 'center', gap: 12, padding: 24 }}>
                <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, letterSpacing: '0.12em', color: '#B9C9E6' }}>
                  <span className="pulse" aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: '#7F93B8' }} />NOT LIVE RIGHT NOW
                </span>
                <span className="display" style={{ fontWeight: 700, fontSize: 26, maxWidth: 460 }}>When the Fed, ECB, Bank of England, Bank of Japan or others speak, the official broadcast plays here.</span>
                <span style={{ color: '#B9C9E6' }}>With a live summary in plain words underneath.</span>
              </div>
            )}
            <div className="row" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, padding: '18px 20px', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 17 }}>Get told the moment a broadcast starts</span>
              <Link href={signedIn ? '/account#telegram' : '/get-started'} style={{ color: '#FFB547', fontWeight: 600, textDecoration: 'none' }}>Turn on alerts »</Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="news-h" className="wrap stack" style={{ padding: '100px 16px 40px', gap: 22 }}>
        <h2 id="news-h" className="h2">News in plain words</h2>
        <div role="group" aria-label="News topic" className="row" style={{ gap: 8 }}>
          {TOPICS.map((t) => <button key={t} type="button" className="toggle" aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}</button>)}
        </div>
        {news.length === 0 ? (
          <Empty>{data.news.length === 0 ? 'News summaries appear here as soon as they are published.' : 'No stories in this topic right now.'}</Empty>
        ) : (
          <div className="grid g-3" style={{ gap: 18 }}>
            {news.map((n) => (
              <article key={n.id} className="card lift stack" style={{ borderRadius: 24, padding: 26, gap: 12 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="chip">{n.tag || n.category}</span>
                  <span className="small faint" suppressHydrationWarning>{fmtDate(n.published_at, Z.tz)} {Z.short}</span>
                </div>
                <h3 className="display" style={{ fontWeight: 700, fontSize: 23, lineHeight: 1.2 }}>{n.title}</h3>
                <p style={{ margin: 0, color: 'var(--text)' }}>{n.body}</p>
                {n.reaction && <span style={{ marginTop: 'auto', fontSize: 15 }}><strong>Markets:</strong> {n.reaction}</span>}
                {n.source && <span className="small faint">Source: {n.source_url ? <a href={n.source_url} target="_blank" rel="noopener noreferrer">{n.source}</a> : n.source}</span>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="stack center" style={{ padding: '50px 16px 90px', textAlign: 'center' }}>
        <div className="stack center" style={{ maxWidth: 1000, gap: 24 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(38px, 5.6vw, 80px)', lineHeight: 1, letterSpacing: '-0.035em' }}>Get These Alerts on Telegram, Free</h2>
          <p className="lead" style={{ maxWidth: 700 }}>Create a free account to choose your markets and get each alert on your phone, before and after it happens.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
            <Link href={signedIn ? '/account#telegram' : '/get-started'} className="btn btn-lg">{signedIn ? 'Connect Telegram' : 'Get Started'} <span className="arr" aria-hidden="true">»</span></Link>
            {telegramUrl && <a href={telegramUrl} className="btn btn-lg btn-outline">Join the Telegram channel <span aria-hidden="true">»</span></a>}
          </div>
          <p className="small faint" style={{ margin: '20px 0 0', maxWidth: 820, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
            <strong style={{ color: 'var(--ink)' }}>Risk note:</strong> Everything on this page is for learning and information, not financial advice. Trading forex, crypto, stocks and commodities carries a high risk of losing money. Past market reactions do not guarantee future results.
          </p>
        </div>
      </section>
    </>
  );
}
