'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CalRow } from '@/lib/terminal/calendar';
import { ZONES, dayKey, dayLabel, fmtTime } from '../markets/time';
import { Playbook } from './Playbook';

const CURRENCIES = ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY'];

function until(ms: number) {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

export function ProCalendar({ initial, error, telegramUrl }: { initial: CalRow[]; error: string; telegramUrl: string }) {
  const [rows, setRows] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [zone, setZone] = useState('WAT');
  const [impact, setImpact] = useState<'High' | 'All'>('High');
  const [cur, setCur] = useState('All');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { const z = localStorage.getItem('mq-zone'); if (z && ZONES.some((x) => x.key === z)) setZone(z); } catch {}
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // refresh often around a release so the actual shows up within seconds
  const hot = rows.some((r) => !r.actual && Math.abs(new Date(r.scheduled_at).getTime() - now) < 30 * 60000);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch('/api/terminal/calendar').then((x) => x.json()).catch(() => null);
      if (r?.ok) setRows(r.events);
    }, hot ? 15000 : 300000);
    return () => clearInterval(t);
  }, [hot]);

  const Z = ZONES.find((z) => z.key === zone) || ZONES[0];
  const list = rows.filter((r) => (impact === 'All' || r.impact === 'High') && (cur === 'All' || r.currency === cur));
  const next = list.find((r) => new Date(r.scheduled_at).getTime() > now - 60000 && r.impact === 'High' && !r.actual);

  // open the next big release's playbook by default
  useEffect(() => { if (next && open[next.id] === undefined) setOpen((o) => ({ ...o, [next.id]: true })); }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const g = new Map<string, CalRow[]>();
    for (const r of list) { const k = dayKey(r.scheduled_at, Z.tz); g.set(k, [...(g.get(k) || []), r]); }
    return [...g.entries()];
  }, [list, Z.tz]);

  return (
    <section className="wrap stack" style={{ padding: '30px 16px 70px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">Pro FX Calendar</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 880 }}>
          Every big release with a live countdown and the official number the moment it is out. Open a playbook to see the five ways the number can land and what the markets did the last times it landed there.
        </p>
      </div>

      {next && (
        <div className="row" style={{ background: '#0B1A36', color: '#fff', borderRadius: 22, padding: '18px 22px', gap: '10px 26px', alignItems: 'center' }}>
          <span className="mono" style={{ color: '#FFB547', fontSize: 13, letterSpacing: '0.1em' }}>NEXT BIG RELEASE</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{next.currency} {next.name}</span>
          <span className="mono" style={{ fontSize: 26, color: '#FFB547' }} suppressHydrationWarning>{until(new Date(next.scheduled_at).getTime() - now)}</span>
          {next.forecast && <span style={{ color: '#C9D6EE' }}>Expected <strong className="mono">{next.forecast}</strong>{next.previous ? <> · last <span className="mono">{next.previous}</span></> : null}</span>}
          {telegramUrl && <a href={telegramUrl} style={{ marginLeft: 'auto', color: '#FFB547', fontWeight: 600, textDecoration: 'none' }}>Playbook on Telegram 15 min before »</a>}
        </div>
      )}

      <div className="row" style={{ gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div role="group" aria-label="Currency" className="row" style={{ gap: 6 }}>
          {CURRENCIES.map((c) => <button key={c} type="button" className="toggle" aria-pressed={cur === c} onClick={() => setCur(c)}>{c}</button>)}
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Impact</span>
            <select className="select-pill" value={impact} onChange={(e) => setImpact(e.target.value as 'High' | 'All')}>
              <option value="High">High only</option>
              <option value="All">High and medium</option>
            </select>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Times in</span>
            <select className="select-pill" value={zone} onChange={(e) => { setZone(e.target.value); try { localStorage.setItem('mq-zone', e.target.value); } catch {} }}>
              {ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="empty">{error}</div>}
      {!error && days.length === 0 && <div className="empty">No releases match this choice. Try another currency or show medium impact too.</div>}

      {days.map(([k, evs]) => (
        <div key={k} className="stack" style={{ gap: 8 }}>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 20, margin: '10px 0 0' }} suppressHydrationWarning>
            {dayLabel(k, Z.tz, now)} <span className="faint" style={{ fontWeight: 500, fontSize: 15 }}>{k}</span>
          </h2>
          {evs.map((e) => {
            const t = new Date(e.scheduled_at).getTime();
            const live = !e.actual && t - now < 15 * 60000 && now - t < 30 * 60000;
            const isOpen = !!open[e.id];
            return (
              <article key={e.id} className="card" style={{ borderRadius: 20, padding: '14px 18px', border: live ? '2px solid #FFB547' : undefined }}>
                <div className="row" style={{ gap: '8px 18px', alignItems: 'center' }}>
                  <span className="stack" style={{ flex: '0 0 92px', gap: 0 }}>
                    <span className="mono" style={{ fontSize: 19 }} suppressHydrationWarning>{fmtTime(e.scheduled_at, Z.tz)}</span>
                    <span className="small" style={{ color: e.actual ? 'var(--faint)' : live ? '#E0592A' : 'var(--blue)', fontWeight: 600 }} suppressHydrationWarning>
                      {e.actual ? 'Out' : t <= now ? 'Waiting for number' : until(t - now)}
                    </span>
                  </span>
                  <span className="chip chip-blue">{e.currency}</span>
                  <span className="stack" style={{ flex: '1 1 240px', gap: 0, minWidth: 0 }}>
                    <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span aria-label={`${e.impact} impact`} title={`${e.impact} impact`} style={{ width: 10, height: 10, borderRadius: '50%', background: e.impact === 'High' ? '#E0592A' : '#FFB547' }} />
                      <span style={{ fontWeight: 700, fontSize: 17 }}>{e.name}</span>
                      {live && <span className="chip pulse" style={{ background: '#FFE1D5', color: '#E0592A' }}>LIVE</span>}
                    </span>
                    {e.simply && <span className="small muted">{e.simply}</span>}
                  </span>
                  <span className="row mono" style={{ gap: '4px 16px', fontSize: 15 }}>
                    <span><span className="faint small">Prev </span>{e.previous || '—'}</span>
                    <span><span className="faint small">Exp </span>{e.forecast || '—'}</span>
                    <span><span className="faint small">Actual </span><strong style={{ fontSize: 17, color: e.actual ? 'var(--ink)' : 'var(--faint)' }}>{e.actual || '—'}</strong></span>
                  </span>
                  {e.forecast ? (
                    <button type="button" className="btn btn-outline btn-sm" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [e.id]: !isOpen }))} style={{ minHeight: 40 }}>
                      {isOpen ? 'Hide playbook' : 'Playbook'} <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                    </button>
                  ) : <span style={{ width: 120 }} />}
                </div>
                {isOpen && (
                  <div className="stack" style={{ gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                    {(e.what || e.why) && <p className="small" style={{ margin: 0 }}>{e.what} {e.why && <><strong>Why it matters:</strong> {e.why}</>}</p>}
                    <Playbook id={e.id} actual={e.actual} />
                    {e.actual && e.result_source && <span className="small faint">Result source: {e.result_url ? <a href={e.result_url} target="_blank" rel="noopener noreferrer">{e.result_source}</a> : e.result_source}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ))}
      <p className="small faint" style={{ margin: 0 }}>Calendar and forecasts: ForexFactory. Results: each country’s official statistics office or central bank. Past moves: measured from real prices after each release. For learning, not financial advice.</p>
    </section>
  );
}
