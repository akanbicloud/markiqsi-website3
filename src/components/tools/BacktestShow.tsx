'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, createChart, createSeriesMarkers, LineStyle, type IChartApi, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts';

/* ------------------------------------------------------------------ types */
export type TradeLog = {
  side: 'Buy' | 'Sell'; entryIdx: number; exitIdx: number; entry: number; sl: number; tp: number;
  result: 'Win' | 'Loss'; pips: number; money: number; equityAfter: number; openTime: string; closeTime: string;
};
export type BT = {
  trades: number; wins: number; losses: number; winRate: number; netPips: number; profitFactor: number | null; maxDrawdownPct: number;
  startEquity: number; endEquity: number; returnPct: number; from: string; to: string; candles: number; equity: number[];
  lastTrades: { time: string; side: string; result: string; pips: number }[]; assumptions: string[];
  log: TradeLog[];
  stats: {
    avgWinMoney: number; avgLossMoney: number; bestTrade: TradeLog | null; worstTrade: TradeLog | null;
    longestWinStreak: number; longestLossStreak: number; drawdownFrom: string; drawdownTo: string;
    months: { month: string; pct: number; trades: number }[];
  };
};
export type Bar = [number, number, number, number, number];
export type BTData = { symbol: string; timeframe: string; digits: number; pip: number; bars: Bar[]; result: BT };

/* ------------------------------------------------------------------ helpers */
const usd = (v: number, sign = false) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const pct = (v: number, sign = true) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
const monthYear = (iso: string | number) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function verdictOf(r: BT): { label: string; color: string; line: string } {
  const dd = r.maxDrawdownPct;
  if (r.trades < 30) return { label: 'NOT ENOUGH DATA', color: '#C9D6EE', line: `Only ${r.trades} trade${r.trades === 1 ? '' : 's'} in this test. That is too few to judge the strategy either way.` };
  if (r.returnPct <= 0) return { label: 'WEAK', color: '#FF8A65', line: `This version lost money: the test account finished ${pct(r.returnPct)} with a worst drop of ${dd.toFixed(1)}%.` };
  const pf = r.profitFactor ?? 99;
  if (pf >= 1.5 && dd <= 20 && r.trades >= 50) return { label: 'STRONG', color: '#3DDC97', line: `Solid on past data: it made ${pct(r.returnPct)} and the worst drop was ${dd.toFixed(1)}%.` };
  if (pf >= 1.1) return { label: 'PROMISING', color: '#FFB547', line: dd >= 10 ? `Profitable, but bumpy: it made ${pct(r.returnPct)} and once dropped ${dd.toFixed(1)}% before recovering.` : `Profitable with small drops: it made ${pct(r.returnPct)} and the worst drop was ${dd.toFixed(1)}%.` };
  return { label: 'WEAK', color: '#FF8A65', line: `Only just profitable: it made ${pct(r.returnPct)}, but it won barely more than it lost (profit factor ${pf}).` };
}

/** Balance line with drops from the top shaded red. */
function EquityChart({ points, height = 200, color = '#1A5FD0', total, id }: { points: { x: number; v: number }[]; height?: number; color?: string; total?: number; id: string }) {
  const W = 760;
  if (points.length < 2) return <div style={{ height, display: 'grid', placeItems: 'center', color: '#5A6780', fontSize: 14 }}>The balance line appears after the first trade closes.</div>;
  const xs = total ?? points[points.length - 1].x;
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const X = (x: number) => (x / (xs || 1)) * W;
  const Y = (v: number) => 8 + ((hi - v) / (hi - lo || 1)) * (height - 16);
  const line = points.map((p) => `${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  let peak = points[0].v;
  const dd: string[] = [];
  for (let k = 1; k < points.length; k++) {
    peak = Math.max(peak, points[k - 1].v);
    if (peak - points[k].v > 0.005 * peak) dd.push(`M${X(points[k - 1].x).toFixed(1)},${Y(peak).toFixed(1)}H${X(points[k].x).toFixed(1)}V${Y(points[k].v).toFixed(1)}H${X(points[k - 1].x).toFixed(1)}Z`);
  }
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label={`Balance went from ${usd(points[0].v)} to ${usd(last.v)}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${X(points[0].x)},${height} ${line} ${X(last.x)},${height}`} fill={`url(#${id})`} />
      <path d={dd.join('')} fill="#E0592A" opacity=".22" />
      <line x1="0" x2={W} y1={Y(points[0].v)} y2={Y(points[0].v)} stroke="#9AA6BC" strokeDasharray="4 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------ replay */
const SPEEDS = [1, 4, 10];
const BASE_SECONDS = 60; // a full replay at 1× takes about a minute; 4× (the default) about 15 seconds

type Live = { trades: number; wins: number; pips: number; balance: number; streak: number; feed: (TradeLog & { k: number })[]; eq: { x: number; v: number }[] };

export function BacktestReplay({ data, strategy, onDone }: { data: BTData; strategy: string; onDone: () => void }) {
  const { bars, result } = data;
  const box = useRef<HTMLDivElement>(null);
  const prog = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const playing = useRef(true);
  const speedRef = useRef(4);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [bubble, setBubble] = useState<{ k: number; x: number; y: number; text: string; win: boolean } | null>(null);
  const [live, setLive] = useState<Live>({ trades: 0, wins: 0, pips: 0, balance: result.startEquity, streak: 0, feed: [], eq: [{ x: 0, v: result.startEquity }] });

  useEffect(() => {
    if (reducedMotion() || !box.current || bars.length < 2) { doneRef.current(); return; }
    const chart: IChartApi = createChart(box.current, {
      autoSize: true,
      layout: { background: { color: '#FFFFFF' }, textColor: '#3A4A66', fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
      grid: { vertLines: { color: '#F3EEE5' }, horzLines: { color: '#F3EEE5' } },
      rightPriceScale: { borderColor: '#E2DACB' },
      timeScale: { borderColor: '#E2DACB', timeVisible: true, secondsVisible: false, barSpacing: box.current.clientWidth < 600 ? 4 : 7, rightOffset: 6 },
      handleScroll: false,
      handleScale: false,
      crosshair: { mode: 2 },
    });
    const series: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
      upColor: '#16A34A', downColor: '#E0592A', borderVisible: false, wickUpColor: '#16A34A', wickDownColor: '#E0592A',
      priceFormat: { type: 'price', precision: data.digits, minMove: 10 ** -data.digits },
    });
    const markersApi: ISeriesMarkersPluginApi<Time> = createSeriesMarkers(series, []);
    const toBar = (b: Bar) => ({ time: b[0] as UTCTimestamp, open: b[1], high: b[2], low: b[3], close: b[4] });

    const opens = new Map<number, TradeLog[]>();
    const closes = new Map<number, TradeLog[]>();
    for (const t of result.log) {
      opens.set(t.entryIdx, [...(opens.get(t.entryIdx) || []), t]);
      closes.set(t.exitIdx, [...(closes.get(t.exitIdx) || []), t]);
    }

    const warm = Math.min(120, bars.length - 1);
    series.setData(bars.slice(0, warm).map(toBar));
    let shown = warm; // number of bars on the chart
    let cursor = warm;
    const marks: SeriesMarker<Time>[] = [];
    let lines: IPriceLine[] = [];
    const st = { trades: 0, wins: 0, pips: 0, balance: result.startEquity, streak: 0, feed: [] as Live['feed'], eq: [{ x: 0, v: result.startEquity }] };
    const perSecond = (bars.length - warm) / BASE_SECONDS;
    let last = performance.now();
    let raf = 0;
    let finished = false;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing.current) cursor = Math.min(bars.length, cursor + dt * perSecond * speedRef.current);
      const upto = Math.floor(cursor);
      let changed = false;
      let closedNow: TradeLog | null = null;
      while (shown < upto) {
        const i = shown;
        series.update(toBar(bars[i]));
        for (const t of opens.get(i) || []) {
          marks.push({ time: bars[i][0] as UTCTimestamp, position: t.side === 'Buy' ? 'belowBar' : 'aboveBar', shape: t.side === 'Buy' ? 'arrowUp' : 'arrowDown', color: t.side === 'Buy' ? '#16A34A' : '#E0592A', text: t.side });
          lines.forEach((l) => series.removePriceLine(l));
          lines = [
            series.createPriceLine({ price: t.tp, color: '#16A34A', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: 'TP' }),
            series.createPriceLine({ price: t.entry, color: '#0B1A36', lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: 'Entry' }),
            series.createPriceLine({ price: t.sl, color: '#E0592A', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: 'SL' }),
          ];
          changed = true;
        }
        for (const t of closes.get(i) || []) {
          marks.push({ time: bars[i][0] as UTCTimestamp, position: 'inBar', shape: 'circle', color: t.result === 'Win' ? '#16A34A' : '#E0592A' });
          lines.forEach((l) => series.removePriceLine(l));
          lines = [];
          st.trades++;
          if (t.result === 'Win') { st.wins++; st.streak = st.streak > 0 ? st.streak + 1 : 1; } else st.streak = st.streak < 0 ? st.streak - 1 : -1;
          st.pips = Math.round((st.pips + t.pips) * 10) / 10;
          st.balance = t.equityAfter;
          st.feed = [{ ...t, k: st.trades }, ...st.feed].slice(0, 7);
          st.eq = [...st.eq, { x: i, v: t.equityAfter }];
          closedNow = t;
          changed = true;
        }
        shown++;
      }
      if (changed) {
        if (marks.length > 120) marks.splice(0, marks.length - 120);
        markersApi.setMarkers([...marks]);
        setLive({ ...st });
      }
      if (closedNow) {
        const t = closedNow;
        const x = chart.timeScale().timeToCoordinate(bars[t.exitIdx][0] as UTCTimestamp);
        const y = series.priceToCoordinate(t.result === 'Win' ? t.tp : t.sl);
        if (x != null && y != null) setBubble({ k: st.trades, x, y, text: `${t.pips > 0 ? '+' : '−'}${Math.abs(t.pips)} pips ${t.result === 'Win' ? '✅' : '❌'}`, win: t.result === 'Win' });
      }
      const p = (shown - warm) / Math.max(1, bars.length - warm);
      if (prog.current) prog.current.style.width = `${(p * 100).toFixed(1)}%`;
      if (pctRef.current) pctRef.current.textContent = `${Math.round(p * 100)}%`;
      if (dateRef.current && shown > 0) dateRef.current.textContent = monthYear(bars[shown - 1][0] * 1000);
      if (shown >= bars.length && !finished) {
        finished = true;
        setTimeout(() => doneRef.current(), 900);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); chart.remove(); };
  }, [bars, result, data.digits]);

  const setSp = (s: number) => { speedRef.current = s; setSpeed(s); };
  const toggle = () => { playing.current = !playing.current; setPaused(!playing.current); };
  const winRate = live.trades ? Math.round((live.wins / live.trades) * 100) : 0;
  const streak = live.streak > 0 ? `🔥 ${live.streak} win${live.streak > 1 ? 's' : ''}` : live.streak < 0 ? `🧊 ${-live.streak} loss${live.streak < -1 ? 'es' : ''}` : '—';

  return (
    <div className="bt-card" aria-label="Backtest replay">
      <div className="bt-top">
        <div>
          <h3 className="display" style={{ fontSize: 'clamp(22px, 3vw, 28px)', margin: 0 }}>Watching your bot trade…</h3>
          <div style={{ color: '#5A6780', fontSize: 14, marginTop: 4 }}>Replaying {bars.length.toLocaleString()} real {data.symbol} candles · {monthYear(result.from)} → {monthYear(result.to)} · {strategy}</div>
        </div>
        <span className="bt-live"><span className="bt-dot" />REPLAY · <span ref={dateRef}>{monthYear(result.from)}</span></span>
      </div>
      <div className="bt-score" aria-live="off">
        <div className="bt-s"><div className="k">Trades</div><div className="v">{live.trades}</div></div>
        <div className="bt-s"><div className="k">Win rate</div><div className="v">{winRate}%</div></div>
        <div className="bt-s"><div className="k">Net pips</div><div className={`v ${live.pips > 0 ? 'bt-up' : live.pips < 0 ? 'bt-down' : ''}`}>{live.pips > 0 ? '+' : ''}{live.pips}</div></div>
        <div className="bt-s"><div className="k">Balance</div><div key={live.trades} className={`v bt-tick ${live.balance >= result.startEquity ? '' : 'bt-down'}`}>{usd(live.balance)}</div></div>
        <div className="bt-s"><div className="k">Streak</div><div className={`v ${live.streak > 0 ? 'bt-up' : live.streak < 0 ? 'bt-down' : ''}`}>{streak}</div></div>
      </div>
      <div className="bt-grid">
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="bt-chart">
            <div ref={box} style={{ position: 'absolute', inset: 0 }} />
            {bubble && <span key={bubble.k} className={`bt-bubble${bubble.win ? '' : ' loss'}`} style={{ left: bubble.x, top: bubble.y }}>{bubble.text}</span>}
          </div>
          <span style={{ fontSize: 12, color: '#5A6780', fontWeight: 600 }}>Account balance (starting {usd(result.startEquity)}) · red = drop from the top</span>
          <EquityChart id="eq-live" points={live.eq} height={100} total={bars.length} />
          <div className="bt-ctrl">
            <button type="button" className="bt-btn" onClick={toggle}>{paused ? '▶ Play' : '⏸ Pause'}</button>
            {SPEEDS.map((s) => <button key={s} type="button" className="bt-btn" aria-pressed={speed === s} onClick={() => setSp(s)}>{s}×</button>)}
            <button type="button" className="bt-btn" onClick={() => doneRef.current()}>Skip to results ⏭</button>
            <div className="bt-prog" aria-hidden="true"><i ref={prog} /></div>
            <span ref={pctRef} style={{ fontSize: 12, fontWeight: 700, color: '#5A6780', minWidth: 34 }}>0%</span>
          </div>
        </div>
        <div className="bt-feed">
          <h3>Trade feed</h3>
          {live.feed.length === 0 && <span style={{ color: '#B9C9E6', fontSize: 13 }}>Waiting for the first signal…</span>}
          {live.feed.map((t) => (
            <div key={t.k} className="bt-fi">
              <span className="d">📅 {dayMonthYear(t.closeTime)}</span>
              <span>{t.side === 'Buy' ? '▲' : '▼'} {t.side} {data.symbol}</span>
              <b className={t.result === 'Win' ? 'bt-up' : 'bt-down'}>{t.pips > 0 ? '+' : '−'}{Math.abs(t.pips)} pips · {usd(t.money, true)} {t.result === 'Win' ? '✅' : '❌'}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ report card */
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function BacktestReport({ data, strategy, timeframeLabel, onReplay, onChangeRules, onDownload }: {
  data: BTData; strategy: string; timeframeLabel: string; onReplay: () => void; onChangeRules: () => void; onDownload: () => void;
}) {
  const r = data.result;
  const s = r.stats;
  const v = verdictOf(r);
  const [share, setShare] = useState(false);
  const eq = useMemo(() => [{ x: 0, v: r.startEquity }, ...r.log.map((t) => ({ x: t.exitIdx, v: t.equityAfter }))], [r]);
  const years = useMemo(() => {
    const m = new Map<number, (typeof s.months[number] | null)[]>();
    for (const x of s.months) {
      const [y, mo] = x.month.split('-').map(Number);
      if (!m.has(y)) m.set(y, new Array(12).fill(null));
      m.get(y)![mo - 1] = x;
    }
    return [...m.entries()];
  }, [s.months]);
  const traded = s.months.filter((x) => x.trades > 0);
  const greenMonths = traded.filter((x) => x.pct > 0).length;
  const spanMonths = Math.max(1, s.months.length);
  const cell = (x: typeof s.months[number]) => {
    if (!x.trades) return <td key={x.month} title={`${x.month}: no trades`} style={{ background: '#F6F1E9', color: '#9AA6BC' }}>·</td>;
    const a = Math.min(1, Math.abs(x.pct) / 4);
    const bg = x.pct > 0 ? `rgba(22,163,74,${0.15 + 0.7 * a})` : x.pct < 0 ? `rgba(224,89,42,${0.15 + 0.7 * a})` : '#EEE7DA';
    return <td key={x.month} title={`${x.month}: ${pct(x.pct)} from ${x.trades} trade${x.trades > 1 ? 's' : ''}`} style={{ background: bg }}>{x.pct > 0 ? '+' : ''}{x.pct.toFixed(1)}</td>;
  };
  const span = `${new Date(r.from).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })} → ${new Date(r.to).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

  const notes: string[] = [];
  if (traded.length) notes.push(`It made money in ${greenMonths} of the ${traded.length} months it traded, so expect losing months too.`);
  if (r.maxDrawdownPct >= 20) notes.push(`The worst drop (${r.maxDrawdownPct.toFixed(1)}%) is large. Lowering the risk per trade makes drops smaller.`);
  if (s.longestLossStreak >= 5) notes.push(`It once lost ${s.longestLossStreak} trades in a row. Be ready for that before going live.`);
  if (r.trades < 30) notes.push('Too few trades to trust. Try a longer period or a smaller timeframe.');

  return (
    <div className="bt-card">
      <div className="bt-verdict">
        <div className="bt-badge" style={{ background: v.color }}>{v.label}<small>strength check</small></div>
        <div style={{ flex: '1 1 300px' }}>
          <div className="display" style={{ fontSize: 'clamp(19px, 2.4vw, 24px)', fontWeight: 700, lineHeight: 1.25 }}>{v.line}</div>
          <div style={{ color: '#B9C9E6', fontSize: 14, marginTop: 6 }}>{strategy} · {data.symbol} · {timeframeLabel} · {span} · {r.candles.toLocaleString()} real candles · spread costs included</div>
        </div>
      </div>
      <div className="bt-tiles">
        <div className="bt-t"><div className="k">Return</div><div className={`v ${r.returnPct > 0 ? 'bt-up' : r.returnPct < 0 ? 'bt-down' : ''}`}>{pct(r.returnPct)}</div><div className="x">{usd(r.startEquity)} → {usd(r.endEquity)}</div></div>
        <div className="bt-t"><div className="k">Win rate</div><div className="v">{Math.round(r.winRate)}%</div><div className="x">{r.wins} wins · {r.losses} losses</div></div>
        <div className="bt-t"><div className="k">Profit factor</div><div className="v">{r.profitFactor ?? '—'}</div><div className="x">{r.profitFactor == null ? 'no losing trades' : `won $${r.profitFactor.toFixed(2)} per $1 lost`}</div></div>
        <div className="bt-t"><div className="k">Worst drop</div><div className="v bt-down">{r.maxDrawdownPct ? `−${r.maxDrawdownPct.toFixed(1)}%` : '0%'}</div><div className="x">{s.drawdownFrom ? `${monthYear(s.drawdownFrom)} → ${monthYear(s.drawdownTo)}` : 'never below the top'}</div></div>
        <div className="bt-t"><div className="k">Trades</div><div className="v">{r.trades}</div><div className="x">≈ {(r.trades / spanMonths).toFixed(r.trades / spanMonths < 10 ? 1 : 0)} per month</div></div>
        <div className="bt-t"><div className="k">Avg win / loss</div><div className="v" style={{ fontSize: 'clamp(16px, 1.8vw, 21px)' }}><span className="bt-up">{usd(s.avgWinMoney, true)}</span> / <span className="bt-down">{usd(s.avgLossMoney)}</span></div><div className="x">per trade</div></div>
      </div>
      <div className="bt-two">
        <div className="bt-box">
          <h3>Account balance over time <span style={{ fontWeight: 600, color: '#5A6780', fontSize: 12 }}>· red = drops from the top · dashed = start</span></h3>
          <EquityChart id="eq-report" points={eq} height={200} total={r.candles} />
          <div className="bt-hl">
            <div className="bt-h">🏆 Best trade<b className="bt-up">{s.bestTrade ? `${usd(s.bestTrade.money, true)} · ${dayMonthYear(s.bestTrade.closeTime)}` : '—'}</b></div>
            <div className="bt-h">💥 Worst trade<b className="bt-down">{s.worstTrade ? `${usd(s.worstTrade.money)} · ${dayMonthYear(s.worstTrade.closeTime)}` : '—'}</b></div>
            <div className="bt-h">🔥 Longest win streak<b>{s.longestWinStreak} trade{s.longestWinStreak === 1 ? '' : 's'}</b></div>
            <div className="bt-h">🧊 Longest losing streak<b>{s.longestLossStreak} trade{s.longestLossStreak === 1 ? '' : 's'}</b></div>
          </div>
        </div>
        <div className="bt-box">
          <h3>Month by month (% return)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="bt-heat">
              <thead><tr><th />{MONTHS.map((m, i) => <th key={i} scope="col">{m}</th>)}</tr></thead>
              <tbody>{years.map(([y, ms]) => <tr key={y}><th scope="row">{y}</th>{ms.map((x, i) => (x ? cell(x) : <td key={`empty-${i}`} />))}</tr>)}</tbody>
            </table>
          </div>
          <div className="bt-warn">
            <b>What this means: </b>{notes.join(' ')} Run it on a <b>demo account</b> for 2 to 4 weeks before real money. Past results do not guarantee future results.
          </div>
        </div>
      </div>
      <div className="bt-actions">
        <button type="button" className="btn btn-sm" style={{ background: '#0B1A36', color: '#FFFFFF' }} onClick={onReplay}>▶ Watch the replay again</button>
        <button type="button" className="btn btn-sm btn-outline" style={{ color: '#0B1A36', borderColor: '#0B1A36' }} onClick={onChangeRules}>✏️ Change the rules</button>
        <button type="button" className="btn btn-sm btn-amber" onClick={onDownload}>⬇ Download MT5 bot</button>
        <button type="button" className="btn btn-sm btn-outline" style={{ color: '#0B1A36', borderColor: '#0B1A36' }} onClick={() => setShare(true)}>📤 Share result card</button>
      </div>
      <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>How this test works</summary><ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#3A4A66' }}>{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
      {share && <ShareModal data={data} strategy={strategy} timeframeLabel={timeframeLabel} onClose={() => setShare(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ share image */
async function drawShareCard(data: BTData, strategy: string, timeframeLabel: string): Promise<HTMLCanvasElement> {
  const r = data.result;
  const v = verdictOf(r);
  const S = 1080;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  try { await document.fonts.ready; } catch { /* fonts optional */ }
  const display = '"Space Grotesk", system-ui, sans-serif';
  const body = '"IBM Plex Sans", system-ui, sans-serif';

  const bg = g.createLinearGradient(0, 0, S * 0.6, S * 1.2);
  bg.addColorStop(0, '#0B1A36');
  bg.addColorStop(0.6, '#14284D');
  bg.addColorStop(1, '#1A4FA8');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  const round = (x: number, y: number, w: number, h: number, rr: number) => { g.beginPath(); g.roundRect(x, y, w, h, rr); };
  const fit = (text: string, max: number, font: (px: number) => string, start: number) => { let px = start; do { g.font = font(px); px -= 2; } while (g.measureText(text).width > max && px > 12); };

  g.textBaseline = 'alphabetic';
  g.fillStyle = '#FFB547';
  g.font = `700 34px ${display}`;
  g.fillText("My bot's backtest on MarkIQ SI", 70, 118);
  // badge
  g.font = `800 26px ${display}`;
  const bw = g.measureText(v.label).width + 40;
  round(S - 70 - bw, 82, bw, 50, 16);
  g.fillStyle = v.color;
  g.fill();
  g.fillStyle = '#0B1A36';
  g.fillText(v.label, S - 70 - bw + 20, 117);

  g.fillStyle = '#B9C9E6';
  const sub = `${strategy} · ${data.symbol} · ${timeframeLabel}`;
  fit(sub, S - 140, (px) => `500 ${px}px ${body}`, 30);
  g.fillText(sub, 70, 172);
  g.font = `500 26px ${body}`;
  g.fillText(`${monthYear(r.from)} → ${monthYear(r.to)} · ${r.trades} trades · ${r.candles.toLocaleString()} real candles`, 70, 212);

  g.fillStyle = r.returnPct >= 0 ? '#3DDC97' : '#FF8A65';
  g.font = `700 150px ${display}`;
  g.fillText(pct(r.returnPct), 62, 372);
  g.fillStyle = '#B9C9E6';
  g.font = `500 28px ${body}`;
  g.fillText(`return on a ${usd(r.startEquity)} test account (${usd(r.startEquity)} → ${usd(r.endEquity)})`, 70, 418);

  // balance line
  const pts = [r.startEquity, ...r.log.map((t) => t.equityAfter)];
  const top = 460, h = 250, left = 70, w = S - 140;
  if (pts.length > 1) {
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const X = (k: number) => left + (k / (pts.length - 1)) * w;
    const Y = (val: number) => top + 10 + ((hi - val) / (hi - lo || 1)) * (h - 20);
    const col = r.returnPct >= 0 ? '61,220,151' : '255,138,101';
    const fill = g.createLinearGradient(0, top, 0, top + h);
    fill.addColorStop(0, `rgba(${col},.35)`);
    fill.addColorStop(1, `rgba(${col},0)`);
    g.beginPath();
    g.moveTo(X(0), top + h);
    pts.forEach((p, k) => g.lineTo(X(k), Y(p)));
    g.lineTo(X(pts.length - 1), top + h);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.setLineDash([8, 10]);
    g.strokeStyle = 'rgba(185,201,230,.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(left, Y(r.startEquity)); g.lineTo(left + w, Y(r.startEquity)); g.stroke();
    g.setLineDash([]);
    g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(X(k), Y(p)) : g.moveTo(X(k), Y(p))));
    g.strokeStyle = `rgb(${col})`;
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
  }

  // three stats
  const stats: [string, string, string][] = [
    ['Win rate', `${Math.round(r.winRate)}%`, '#FFFFFF'],
    ['Profit factor', r.profitFactor == null ? '—' : r.profitFactor.toFixed(2), '#FFFFFF'],
    ['Worst drop', r.maxDrawdownPct ? `−${r.maxDrawdownPct.toFixed(1)}%` : '0%', '#FF8A65'],
  ];
  const cw = (S - 140 - 40) / 3;
  stats.forEach(([k, val, c], i) => {
    const x = 70 + i * (cw + 20);
    round(x, 750, cw, 150, 26);
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fill();
    g.fillStyle = '#B9C9E6';
    g.font = `500 24px ${body}`;
    g.fillText(k, x + 26, 796);
    g.fillStyle = c;
    g.font = `700 58px ${display}`;
    g.fillText(val, x + 26, 870);
  });

  // footer
  g.fillStyle = '#FFFFFF';
  g.font = `700 34px ${display}`;
  g.fillText('MarkIQ SI', 70, 978);
  g.fillStyle = '#B9C9E6';
  g.font = `500 24px ${body}`;
  g.fillText('Build & test your own bot at markiqsi.com', 70, 1018);
  g.textAlign = 'right';
  g.font = `500 20px ${body}`;
  g.fillText('Backtest on past data.', S - 70, 982);
  g.fillText('Not financial advice.', S - 70, 1012);
  g.textAlign = 'left';
  return cv;
}

function ShareModal({ data, strategy, timeframeLabel, onClose }: { data: BTData; strategy: string; timeframeLabel: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState('');
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let gone = false;
    let made = '';
    drawShareCard(data, strategy, timeframeLabel).then((cv) => cv.toBlob((b) => {
      if (gone || !b) return;
      made = URL.createObjectURL(b);
      setBlob(b);
      setUrl(made);
    }, 'image/png'));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    closeBtn.current?.focus();
    return () => { gone = true; window.removeEventListener('keydown', esc); if (made) URL.revokeObjectURL(made); };
  }, [data, strategy, timeframeLabel, onClose]);

  const fileName = `markiq-backtest-${data.symbol.replace(/\W+/g, '')}.png`;
  const text = `My bot's backtest on MarkIQ SI: ${pct(data.result.returnPct)} on ${data.symbol}. Build and test your own bot at https://www.markiqsi.com/tools`;
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

  async function doShare() {
    if (!file) return;
    try { await navigator.share({ files: [file], text, title: 'My MarkIQ SI backtest' }); } catch { /* user closed the share sheet */ }
  }
  function doDownload() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  }

  return (
    <div className="bt-modal" role="dialog" aria-modal="true" aria-label="Share your result" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>Share your result</span>
          <button ref={closeBtn} type="button" className="bt-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {url ? <img src={url} alt="Your backtest result card" style={{ width: '100%', borderRadius: 16 }} /> : <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center' }}><span className="spinner" aria-label="Making the image" /></div>}
        <div className="row" style={{ gap: 10 }}>
          {canShare && <button type="button" className="btn btn-sm" style={{ background: '#0B1A36', color: '#FFFFFF' }} onClick={doShare}>📤 Share</button>}
          <button type="button" className="btn btn-sm btn-amber" onClick={doDownload} disabled={!url}>⬇ Download image</button>
          <button type="button" className="btn btn-sm btn-outline" style={{ color: '#0B1A36', borderColor: '#0B1A36' }} onClick={() => navigator.clipboard?.writeText(text).then(() => setNote('Text copied. Paste it with the image.'))}>Copy text</button>
        </div>
        {note && <span role="status" style={{ fontSize: 14, color: '#0B4A2E' }}>{note}</span>}
        <span style={{ fontSize: 13, color: '#5A6780' }}>The image shows a test on past data, not live trading results.</span>
      </div>
    </div>
  );
}
