'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, LineSeries, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts';
import { SYMBOLS, TIMEFRAMES, type TF } from '@/lib/trading/symbols';
import { ema } from '@/lib/trading/indicators';

type Candle = { t: number; o: number; h: number; l: number; c: number };
type Trade = { id: number; side: 'Buy' | 'Sell'; entry: number; sl: number; tp: number; openIdx: number; closeIdx?: number; result?: 'Win' | 'Loss'; pips?: number };

const SPEEDS = [1, 2, 5, 10];
const toBar = (x: Candle) => ({ time: Math.floor(x.t / 1000) as UTCTimestamp, open: x.o, high: x.h, low: x.l, close: x.c });

export function ChartLab({ initialSymbol }: { initialSymbol?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lines = useRef<Record<string, ISeriesApi<'Line'>>>({});
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const loadingOlder = useRef(false);
  const focusReplay = useRef(false);

  const [sym, setSym] = useState(initialSymbol || 'EURUSD');
  const [tf, setTf] = useState<TF>('1day');
  const [data, setData] = useState<Candle[]>([]);
  const [pip, setPip] = useState(0.0001);
  const [reachedStart, setReachedStart] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [emas, setEmas] = useState<number[]>([20, 50, 200]);

  const [replay, setReplay] = useState<{ on: boolean; picking: boolean; idx: number; playing: boolean; speed: number }>({ on: false, picking: false, idx: 0, playing: false, speed: 2 });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [slP, setSlP] = useState('20');
  const [tpP, setTpP] = useState('40');
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const dataRef = useRef(data);
  dataRef.current = data;

  // ---------- chart setup ----------
  useEffect(() => {
    if (!box.current) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { color: dark ? '#0B1A36' : '#FFFFFF' }, textColor: dark ? '#C9D6EE' : '#3A4A66', fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
      grid: { vertLines: { color: dark ? '#14284d' : '#F0EBE2' }, horzLines: { color: dark ? '#14284d' : '#F0EBE2' } },
      rightPriceScale: { borderColor: dark ? '#2B4A82' : '#E2DACB' },
      timeScale: { borderColor: dark ? '#2B4A82' : '#E2DACB', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    const s = c.addSeries(CandlestickSeries, { upColor: '#16A34A', downColor: '#E0592A', borderVisible: false, wickUpColor: '#16A34A', wickDownColor: '#E0592A' });
    chart.current = c;
    series.current = s;
    markers.current = createSeriesMarkers(s, []);
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = {};
      markers.current = null;
    };
  }, []);

  // ---------- data loading ----------
  const load = useCallback(async (before?: number) => {
    const u = new URLSearchParams({ symbol: sym, tf, limit: '3000' });
    if (before) u.set('before', String(before));
    const r = await fetch(`/api/history?${u}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load the chart.');
    setPip(d.pip);
    return d as { candles: Candle[]; reachedStart: boolean };
  }, [sym, tf]);

  useEffect(() => {
    let alive = true;
    setBusy('Loading chart…');
    setErr('');
    setReplay((r) => ({ ...r, on: false, picking: false, playing: false }));
    setTrades([]);
    load()
      .then((d) => {
        if (!alive) return;
        setData(d.candles);
        setReachedStart(d.reachedStart);
        setTimeout(() => chart.current?.timeScale().fitContent(), 0);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setBusy(''));
    return () => { alive = false; };
  }, [load]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder.current || reachedStart || !dataRef.current.length) return 0;
    loadingOlder.current = true;
    setBusy('Loading older history…');
    try {
      const d = await load(dataRef.current[0].t);
      const added = d.candles.filter((x) => x.t < dataRef.current[0].t);
      if (added.length) {
        const range = chart.current?.timeScale().getVisibleLogicalRange();
        const next = [...added, ...dataRef.current];
        dataRef.current = next;
        setData(next);
        if (range) setTimeout(() => chart.current?.timeScale().setVisibleLogicalRange({ from: range.from + added.length, to: range.to + added.length }), 0);
      }
      if (d.reachedStart || !added.length) setReachedStart(true);
      return added.length;
    } catch (e) {
      setErr((e as Error).message);
      return 0;
    } finally {
      loadingOlder.current = false;
      setBusy('');
    }
  }, [load, reachedStart]);

  // scroll left to load more
  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const h = (range: { from: number; to: number } | null) => {
      if (range && range.from < 20 && !replayRef.current.on) loadOlder();
    };
    c.timeScale().subscribeVisibleLogicalRangeChange(h);
    return () => c.timeScale().unsubscribeVisibleLogicalRangeChange(h);
  }, [loadOlder]);

  async function loadYears(years: number) {
    const target = Date.now() - years * 365.25 * 86400000;
    let guard = 0;
    while (dataRef.current.length && dataRef.current[0].t > target && guard++ < 12) {
      const n = await loadOlder();
      if (!n) break;
    }
    const first = dataRef.current.findIndex((x) => x.t >= target);
    setTimeout(() => chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, first), to: dataRef.current.length + 3 }), 50);
  }

  // ---------- drawing ----------
  const visible = useMemo(() => (replay.on && !replay.picking ? data.slice(0, replay.idx + 1) : data), [data, replay.on, replay.picking, replay.idx]);
  useEffect(() => {
    const s = series.current;
    const c = chart.current;
    if (!s || !c) return;
    s.setData(visible.map(toBar));
    const closes = visible.map((x) => x.c);
    const colors: Record<number, string> = { 20: '#1A5FD0', 50: '#FFB547', 200: '#7C3AED' };
    for (const n of [20, 50, 200]) {
      const on = emas.includes(n);
      if (on && !lines.current[n]) lines.current[n] = c.addSeries(LineSeries, { color: colors[n], lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      if (!on && lines.current[n]) { c.removeSeries(lines.current[n]); delete lines.current[n]; }
      if (on) {
        const e = ema(closes, n);
        lines.current[n].setData(visible.map((x, i) => (Number.isNaN(e[i]) ? { time: toBar(x).time } : { time: toBar(x).time, value: e[i] })));
      }
    }
    const m: SeriesMarker<Time>[] = [];
    for (const t of trades) {
      const ob = data[t.openIdx];
      if (ob && t.openIdx < visible.length) m.push({ time: toBar(ob).time, position: t.side === 'Buy' ? 'belowBar' : 'aboveBar', color: t.side === 'Buy' ? '#16A34A' : '#E0592A', shape: t.side === 'Buy' ? 'arrowUp' : 'arrowDown', text: t.side });
      const cb = t.closeIdx != null ? data[t.closeIdx] : null;
      if (cb && t.closeIdx! < visible.length) m.push({ time: toBar(cb).time, position: 'inBar', color: t.result === 'Win' ? '#16A34A' : '#E0592A', shape: 'circle', text: `${t.result} ${t.pips! > 0 ? '+' : ''}${t.pips}p` });
    }
    m.sort((a, b) => Number(a.time) - Number(b.time));
    markers.current?.setMarkers(m);
    if (replayRef.current.on && !replayRef.current.picking) {
      const last = visible.length - 1;
      const ts = c.timeScale();
      if (focusReplay.current) {
        focusReplay.current = false;
        ts.setVisibleLogicalRange({ from: last - 150, to: last + 8 });
      } else {
        const rg = ts.getVisibleLogicalRange();
        if (rg && rg.to < last + 2) ts.setVisibleLogicalRange({ from: rg.from + (last + 8 - rg.to), to: last + 8 });
      }
    }
  }, [visible, emas, trades, data]);

  // ---------- replay ----------
  useEffect(() => {
    if (!replay.on || !replay.playing) return;
    const t = setInterval(() => step(1), 1000 / replay.speed);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.on, replay.playing, replay.speed]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    const h = (p: { time?: Time }) => {
      if (!replayRef.current.picking || p.time == null) return;
      const t = Number(p.time) * 1000;
      const idx = Math.max(60, dataRef.current.findIndex((x) => x.t >= t));
      focusReplay.current = true;
      setReplay((r) => ({ ...r, picking: false, idx: Math.min(idx, dataRef.current.length - 2), playing: false }));
      setTrades([]);
    };
    c.subscribeClick(h);
    return () => c.unsubscribeClick(h);
  }, []);

  function step(n: number) {
    setReplay((r) => {
      const idx = Math.max(60, Math.min(dataRef.current.length - 1, r.idx + n));
      if (idx >= dataRef.current.length - 1) return { ...r, idx, playing: false };
      return { ...r, idx };
    });
  }

  // settle open practice trades as candles appear
  useEffect(() => {
    if (!replay.on) return;
    setTrades((ts) => {
      let changed = false;
      const out = ts.map((t) => {
        if (t.result) return t;
        for (let i = t.openIdx + 1; i <= replay.idx; i++) {
          const b = data[i];
          const hitSl = t.side === 'Buy' ? b.l <= t.sl : b.h >= t.sl;
          const hitTp = t.side === 'Buy' ? b.h >= t.tp : b.l <= t.tp;
          if (hitSl || hitTp) {
            changed = true;
            const win = !hitSl;
            const pips = Math.round((win ? Math.abs(t.tp - t.entry) : -Math.abs(t.entry - t.sl)) / pip * 10) / 10;
            return { ...t, closeIdx: i, result: (win ? 'Win' : 'Loss') as 'Win' | 'Loss', pips };
          }
        }
        return t;
      });
      return changed ? out : ts;
    });
  }, [replay.idx, replay.on, data, pip]);

  function startReplay() {
    if (data.length < 100) return;
    setTrades([]);
    setReplay({ on: true, picking: true, idx: Math.max(60, data.length - 200), playing: false, speed: replay.speed });
  }
  async function startFromDate(v: string) {
    const t = Date.parse(v + 'T00:00:00Z');
    if (!Number.isFinite(t)) return;
    let guard = 0;
    while (dataRef.current.length && dataRef.current[0].t > t - 100 * 86400000 && guard++ < 15) {
      const n = await loadOlder();
      if (!n) break;
    }
    const data = dataRef.current;
    const idx = data.findIndex((x) => x.t >= t);
    if (idx < 0) return;
    setTrades([]);
    focusReplay.current = true;
    setReplay((r) => ({ ...r, on: true, picking: false, idx: Math.max(60, Math.min(idx, data.length - 2)), playing: false }));
  }
  function practice(side: 'Buy' | 'Sell') {
    const b = data[replay.idx];
    if (!b) return;
    const sl = (parseFloat(slP) || 20) * pip;
    const tp = (parseFloat(tpP) || 40) * pip;
    setTrades((ts) => [...ts, { id: Date.now(), side, entry: b.c, sl: side === 'Buy' ? b.c - sl : b.c + sl, tp: side === 'Buy' ? b.c + tp : b.c - tp, openIdx: replay.idx }]);
  }

  const closed = trades.filter((t) => t.result);
  const totalPips = Math.round(closed.reduce((s, t) => s + (t.pips || 0), 0) * 10) / 10;
  const cur = data[replay.on ? replay.idx : data.length - 1];
  const fmtD = (ms: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: tf.includes('min') || tf.endsWith('h') ? '2-digit' : undefined, minute: tf.includes('min') || tf.endsWith('h') ? '2-digit' : undefined, timeZone: 'UTC' }).format(new Date(ms));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <label className="sr-only" htmlFor="cl-sym">Market</label>
        <select id="cl-sym" className="select-pill" value={sym} onChange={(e) => setSym(e.target.value)}>
          {SYMBOLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="row" role="group" aria-label="Timeframe" style={{ gap: 6 }}>
          {TIMEFRAMES.map((t) => <button key={t.key} type="button" className="toggle" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} aria-pressed={tf === t.key} onClick={() => setTf(t.key)}>{t.label}</button>)}
        </div>
      </div>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <span className="small faint">History:</span>
        {[1, 5, 10, 20].map((y) => <button key={y} type="button" className="toggle" style={{ minHeight: 38, padding: '0 12px', fontSize: 14 }} onClick={() => loadYears(y)} disabled={replay.on}>{y}Y</button>)}
        <span className="small faint" style={{ marginLeft: 8 }}>Lines:</span>
        {[20, 50, 200].map((n) => <button key={n} type="button" className="toggle" style={{ minHeight: 38, padding: '0 12px', fontSize: 14 }} aria-pressed={emas.includes(n)} onClick={() => setEmas(emas.includes(n) ? emas.filter((x) => x !== n) : [...emas, n])}>EMA {n}</button>)}
        <span className="small faint" style={{ marginLeft: 'auto' }}>{data.length ? `${data.length.toLocaleString()} candles · from ${fmtD(data[0].t)}${reachedStart ? ' (start of history)' : ''}` : ''}</span>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={box} style={{ height: 'min(70vh, 600px)', minHeight: 420, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line-soft)', cursor: replay.picking ? 'crosshair' : 'default' }} />
        {(busy || err) && (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <span className={`note ${err ? 'note-bad' : 'note-info'}`} style={{ pointerEvents: 'auto' }}>{err || busy}</span>
          </div>
        )}
        {replay.picking && <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)' }} className="note note-warn">Click the candle where the replay should start, or pick a date below.</div>}
      </div>

      <div className="inset stack" style={{ gap: 12, borderRadius: 22 }}>
        {!replay.on ? (
          <div className="row" style={{ alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <div className="stack" style={{ gap: 2 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>Bar replay</span>
              <span className="small faint">Go back to any date, hide the future, and play the market candle by candle. Practise buys and sells without risking money.</span>
            </div>
            <button type="button" className="btn btn-sm" onClick={startReplay} disabled={data.length < 100}>Start replay <span className="arr" aria-hidden="true">»</span></button>
          </div>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'center', gap: 10 }}>
              <span className="chip chip-amber">Replay</span>
              <span className="mono small" aria-live="polite">{cur ? fmtD(cur.t) : ''}</span>
              <label className="row small" style={{ alignItems: 'center', gap: 6 }}>Start at
                <input type="date" className="select-pill" style={{ minHeight: 38 }} onChange={(e) => startFromDate(e.target.value)} />
              </label>
              <button type="button" className="toggle" style={{ minHeight: 40 }} onClick={() => step(-1)} disabled={replay.picking} aria-label="One candle back">◀ Back</button>
              <button type="button" className="toggle" style={{ minHeight: 40 }} aria-pressed={replay.playing} onClick={() => setReplay((r) => ({ ...r, playing: !r.playing }))} disabled={replay.picking}>{replay.playing ? 'Pause' : 'Play'}</button>
              <button type="button" className="toggle" style={{ minHeight: 40 }} onClick={() => step(1)} disabled={replay.picking} aria-label="Next candle">Next ▶</button>
              <label className="row small" style={{ alignItems: 'center', gap: 6 }}>Speed
                <select className="select-pill" style={{ minHeight: 38 }} value={replay.speed} onChange={(e) => setReplay((r) => ({ ...r, speed: Number(e.target.value) }))}>
                  {SPEEDS.map((s) => <option key={s} value={s}>{s} candle{s > 1 ? 's' : ''}/sec</option>)}
                </select>
              </label>
              <button type="button" className="linkbtn" onClick={() => { setReplay((r) => ({ ...r, on: false, playing: false, picking: false })); setTimeout(() => chart.current?.timeScale().scrollToRealTime(), 50); }}>Exit replay</button>
            </div>
            {!replay.picking && (
              <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
                <label className="field" style={{ width: 120 }}><span className="small">Stop loss (pips)</span><input className="input" style={{ minHeight: 42 }} type="number" value={slP} onChange={(e) => setSlP(e.target.value)} /></label>
                <label className="field" style={{ width: 120 }}><span className="small">Take profit (pips)</span><input className="input" style={{ minHeight: 42 }} type="number" value={tpP} onChange={(e) => setTpP(e.target.value)} /></label>
                <button type="button" className="btn btn-sm" style={{ background: '#16A34A', color: '#FFFFFF' }} onClick={() => practice('Buy')}>Practice buy</button>
                <button type="button" className="btn btn-sm" style={{ background: '#E0592A', color: '#FFFFFF' }} onClick={() => practice('Sell')}>Practice sell</button>
                <span className="small" style={{ marginLeft: 'auto' }}>
                  {trades.length ? `${closed.length} closed · ${closed.filter((t) => t.result === 'Win').length} wins · ${totalPips > 0 ? '+' : ''}${totalPips} pips · ${trades.length - closed.length} open` : 'No practice trades yet.'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <span className="small faint">Price history from Twelve Data, chart by TradingView Lightweight Charts™. Scroll left to load more history. Forex prices are indicative and can differ slightly from your broker.</span>
    </div>
  );
}
