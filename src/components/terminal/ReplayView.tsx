'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData } from '@/lib/terminal/data';
import type { ReplayEvent } from '@/lib/terminal/replay';
import { replayStats } from '@/lib/terminal/replaystats';
import { MARKETS } from '@/lib/terminal/pressure';
import type { Candle } from '@/lib/trading/indicators';
import { C, TerminalChart } from './TerminalChart';

const DIGITS: Record<string, number> = { XAUUSD: 2, EURUSD: 5, GBPUSD: 5, USDJPY: 3, SPY: 2, BTCUSD: 0 };
const SPEEDS = [1, 4, 10];
const pct = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ReplayView() {
  const [events, setEvents] = useState<ReplayEvent[] | null>(null);
  const [evErr, setEvErr] = useState('');
  const [find, setFind] = useState('');
  const [pick, setPick] = useState<ReplayEvent | null>(null);
  const [market, setMarket] = useState('EURUSD');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0); // candles revealed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/terminal/replay').then((r) => r.json()).then((d) => {
      if (!d.ok) { setEvErr(d.error || 'Could not load past releases.'); return; }
      setEvents(d.events);
      const first = (d.events as ReplayEvent[]).find((e) => /cpi|payroll|non-farm/i.test(e.name)) || d.events[0];
      if (first) setPick(first);
    }).catch(() => setEvErr('Could not load past releases.'));
  }, []);

  useEffect(() => {
    if (!pick) return;
    let live = true;
    setBusy(true); setErr(''); setCandles(null); setPlaying(false);
    fetch(`/api/terminal/replay/candles?market=${market}&at=${encodeURIComponent(pick.at)}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!live) return; if (!r.ok || !d.ok) setErr(d.error || 'Could not load this replay.'); else setCandles(d.candles); })
      .catch(() => live && setErr('Could not load this replay.'))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [pick, market]);

  const atMs = pick ? new Date(pick.at).getTime() : 0;
  const stats = useMemo(() => (candles ? replayStats(candles, atMs) : null), [candles, atMs]);
  const start = stats ? Math.max(1, stats.index - 8) : 1;

  // start two hours before the release and play automatically
  useEffect(() => { if (candles && stats) { setK(start); setPlaying(true); } }, [candles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!playing || !candles) return;
    timer.current = setInterval(() => setK((x) => { if (x >= candles.length) { setPlaying(false); return x; } return x + 1; }), 1000 / speed);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, speed, candles]);

  const label = MARKETS.find((m) => m.key === market)?.label || market;
  const data: ChartData | null = useMemo(() => {
    if (!candles || !pick || !stats) return null;
    const c = candles[stats.index];
    const mv = c.o ? ((c.c - c.o) / c.o) * 100 : 0;
    return {
      market, label, tf: '15min', digits: DIGITS[market] ?? 4, pricingIn: [], updated: '',
      candles: candles.map((x) => ({ ...x, score: null, parts: [] })),
      events: [{ i: stats.index, t: c.t, kind: 'data', theme: 'data', icon: '📊', head: pick.name.slice(0, 40), detail: `${pick.actual ?? ''}${pick.forecast ? ` vs ${pick.forecast} expected` : ''}`, dir: Math.abs(mv) < 0.005 ? null : mv > 0 ? 'up' : 'down', move: mv, count: 1 }],
    };
  }, [candles, pick, stats, market, label]);

  const released = stats ? k > stats.index : false;
  const sofar = useMemo(() => (candles && stats && released ? replayStats(candles.slice(0, k), atMs) : null), [candles, stats, released, k, atMs]);
  const list = (events || []).filter((e) => !find || e.name.toLowerCase().includes(find.toLowerCase())).slice(0, 80);

  return (
    <section className="wrap stack" style={{ padding: '30px 16px 70px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">Event Replay</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 860 }}>Pick a past release and watch the market react candle by candle, from two hours before to nine hours after. Pause, speed up, or drag the gold line.</p>
      </div>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
        <aside className="card stack" style={{ flex: '1 1 280px', maxWidth: 360, borderRadius: 22, padding: 18, gap: 10 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Past releases</span>
            <input className="input" placeholder="Search: CPI, payrolls, GDP…" value={find} onChange={(e) => setFind(e.target.value)} />
          </label>
          {evErr && <span className="small" style={{ color: '#d4452f' }}>{evErr}</span>}
          {!events && !evErr && <span className="small faint pulse">Loading…</span>}
          {events && events.length === 0 && <span className="small faint">Past releases appear here as the history fills in.</span>}
          <div className="stack" style={{ gap: 4, maxHeight: 460, overflowY: 'auto' }} role="listbox" aria-label="Past releases">
            {list.map((e) => {
              const on = pick?.at === e.at && pick?.name === e.name;
              return (
                <button key={e.name + e.at} type="button" role="option" aria-selected={on} onClick={() => setPick(e)}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 12, border: `1px solid ${on ? '#FFB547' : 'var(--line-soft)'}`, background: on ? 'rgba(255,181,71,0.14)' : 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', font: 'inherit' }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="small faint mono">{when(e.at)}{e.actual ? ` · ${e.actual}${e.forecast ? ` vs ${e.forecast}` : ''}` : ''}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="stack" style={{ flex: '3 1 600px', minWidth: 0, gap: 12 }}>
          <div role="tablist" aria-label="Market" className="tabs" style={{ overflowX: 'auto' }}>
            {MARKETS.map((m) => <button key={m.key} type="button" role="tab" aria-selected={m.key === market} className="toggle" onClick={() => setMarket(m.key)}>{m.label}</button>)}
          </div>
          {data && candles ? (
            <TerminalChart data={data} height={440} showPressure={false} reveal={Math.max(0.02, k / candles.length)} onReveal={(r) => { setPlaying(false); setK(Math.max(1, Math.round(r * candles.length))); }} />
          ) : (
            <div className="stack center" style={{ height: 440, borderRadius: 18, background: C.bg, justifyContent: 'center', color: '#B9C9E6', padding: 24, textAlign: 'center' }}>
              {busy ? <span className="pulse">Loading the candles around this release…</span> : err || 'Pick a release.'}
            </div>
          )}
          {data && candles && stats && (
            <>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-sm" onClick={() => { if (k >= candles.length) setK(start); setPlaying(!playing); }} style={{ minWidth: 104 }}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setK(start); setPlaying(true); }}>⟲ Restart</button>
                <span role="group" aria-label="Speed" className="row" style={{ gap: 6 }}>
                  {SPEEDS.map((s) => <button key={s} type="button" className="toggle" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}
                </span>
                <span className="mono small faint" style={{ marginLeft: 'auto' }}>{new Date(candles[Math.max(0, k - 1)].t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="grid g-4" style={{ gap: 10 }}>
                {[
                  ['Release', released ? `${pick?.actual ?? '—'}${pick?.forecast ? ` vs ${pick.forecast}` : ''}` : `In ${Math.max(0, (stats.index - k + 1) * 15)} min`],
                  ['After 15 min', released ? pct(sofar?.m15 ?? null) : '—'],
                  ['After 1 hour', released && k > stats.index + 4 ? pct(sofar?.m60 ?? null) : '—'],
                  ['Range since release', released && sofar ? `${pct(sofar.low)} to ${pct(sofar.high)}` : '—'],
                ].map(([t, v]) => (
                  <div key={t} className="inset stack" style={{ gap: 2 }}>
                    <span className="small faint">{t}</span>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              {pick?.surprise && released && <span className="small"><strong>Result:</strong> {pick.surprise}. Moves are measured from the open of the release candle.</span>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
