'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, HistogramSeries, LineSeries, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts';
import { ENTRY_GROUPS, type EntryKind, type Rules } from '@/lib/trading/botspec';
import {
  DEFAULT_INDICATOR, INDICATOR_EXAMPLES, LINE_LABEL, PANEL_LABEL, computePreview, describeIndicator, sanitizeIndicator, toMql5Indicator, toPineIndicator,
  type IndicatorSpec, type LineType, type PanelType,
} from '@/lib/trading/indicatorspec';
import { SYMBOLS, TIMEFRAMES, type TF } from '@/lib/trading/symbols';
import type { Candle } from '@/lib/trading/indicators';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const t = (x: Candle) => Math.floor(x.t / 1000) as UTCTimestamp;
const pts = (c: Candle[], v: number[]) => c.map((x, i) => ({ time: t(x), value: v[i] })).filter((p) => Number.isFinite(p.value));

function chartOptions() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    autoSize: true,
    layout: { background: { color: dark ? '#0B1A36' : '#FFFFFF' }, textColor: dark ? '#C9D6EE' : '#3A4A66', fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
    grid: { vertLines: { color: dark ? '#14284d' : '#F0EBE2' }, horzLines: { color: dark ? '#14284d' : '#F0EBE2' } },
    rightPriceScale: { borderColor: dark ? '#2B4A82' : '#E2DACB' },
    timeScale: { borderColor: dark ? '#2B4A82' : '#E2DACB', timeVisible: true, secondsVisible: false },
    crosshair: { mode: 0 as const },
  };
}

function PreviewChart({ candles, spec, symbol }: { candles: Candle[]; spec: IndicatorSpec; symbol: string }) {
  const priceBox = useRef<HTMLDivElement>(null);
  const panelBox = useRef<HTMLDivElement>(null);
  const preview = useMemo(() => computePreview(spec, candles, symbol), [spec, candles, symbol]);
  const counts = useMemo(() => ({ buy: preview.signals.filter((s) => s === 1).length, sell: preview.signals.filter((s) => s === -1).length }), [preview]);

  useEffect(() => {
    if (!priceBox.current || !candles.length) return;
    const c: IChartApi = createChart(priceBox.current, chartOptions());
    const s: ISeriesApi<'Candlestick'> = c.addSeries(CandlestickSeries, { upColor: '#16A34A', downColor: '#E0592A', borderVisible: false, wickUpColor: '#16A34A', wickDownColor: '#E0592A' });
    s.setData(candles.map((x) => ({ time: t(x), open: x.o, high: x.h, low: x.l, close: x.c })));
    for (const l of preview.lines) c.addSeries(LineSeries, { color: l.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: '' }).setData(pts(candles, l.values));
    const m: ISeriesMarkersPluginApi<Time> = createSeriesMarkers(s, []);
    const marks: SeriesMarker<Time>[] = [];
    preview.signals.forEach((v, i) => {
      if (v === 1) marks.push({ time: t(candles[i]), position: 'belowBar', color: '#16A34A', shape: 'arrowUp', text: 'Buy' });
      if (v === -1) marks.push({ time: t(candles[i]), position: 'aboveBar', color: '#E0592A', shape: 'arrowDown', text: 'Sell' });
    });
    m.setMarkers(marks);
    c.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 220), to: candles.length + 5 });

    let p: IChartApi | null = null;
    if (preview.panel && panelBox.current) {
      p = createChart(panelBox.current, chartOptions());
      for (const ser of preview.panel.series) {
        if (ser.histogram) p.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }).setData(candles.map((x, i) => ({ time: t(x), value: ser.values[i], color: ser.values[i] >= 0 ? 'rgba(14,165,164,0.55)' : 'rgba(224,89,42,0.55)' })).filter((d) => Number.isFinite(d.value)));
        else {
          const ls = p.addSeries(LineSeries, { color: ser.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          ls.setData(pts(candles, ser.values));
          if (ser === preview.panel.series[preview.panel.series.length - 1] || preview.panel.series.length === 1) {
            for (const lv of preview.panel.levels) ls.createPriceLine({ price: lv, color: '#94A3B8', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
          }
        }
      }
      // Keep both charts scrolled to the same place.
      const a = c, b = p;
      a.timeScale().subscribeVisibleLogicalRangeChange((r) => r && b.timeScale().setVisibleLogicalRange(r));
      b.timeScale().subscribeVisibleLogicalRangeChange((r) => r && a.timeScale().setVisibleLogicalRange(r));
      b.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 220), to: candles.length + 5 });
    }
    return () => {
      c.remove();
      p?.remove();
    };
  }, [candles, preview]);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div ref={priceBox} style={{ height: 420, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)' }} />
      {preview.panel && (
        <>
          <span className="faint" style={{ fontSize: 14 }}>{preview.panel.name}</span>
          <div ref={panelBox} style={{ height: 160, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)' }} />
        </>
      )}
      <span style={{ fontSize: 15 }}>
        {spec.signals ? <><strong>{counts.buy}</strong> buy and <strong>{counts.sell}</strong> sell arrows on the last {candles.length.toLocaleString()} candles. Scroll the chart to check each one.</> : 'No arrows: add signals below if you want buy and sell arrows.'}
      </span>
    </div>
  );
}

export function IndicatorBuilder({ signedIn }: { signedIn: boolean }) {
  const [text, setText] = useState(INDICATOR_EXAMPLES[0]);
  const [spec, setSpec] = useState<IndicatorSpec | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [sym, setSym] = useState('EURUSD');
  const [tf, setTf] = useState<TF>('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartErr, setChartErr] = useState('');
  const [show, setShow] = useState<'' | 'pine' | 'mql5'>('');
  const [copied, setCopied] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  const [mine, setMine] = useState<{ id: number; name: string; spec: IndicatorSpec; description: string }[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/indicators').then((r) => r.json()).then((d) => d.ok && setMine(d.indicators)).catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    if (!spec) return;
    let alive = true;
    setBusy('chart');
    setChartErr('');
    fetch(`/api/history?${new URLSearchParams({ symbol: sym, tf, limit: '1500' })}`)
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (!alive) return;
        if (!r.ok || !d.ok) throw new Error(d.error || 'Could not load the chart.');
        setCandles(d.candles);
      })
      .catch((e) => alive && setChartErr((e as Error).message))
      .finally(() => alive && setBusy(''));
    return () => { alive = false; };
  }, [sym, tf, !!spec]); // eslint-disable-line react-hooks/exhaustive-deps

  async function build() {
    setBusy('parse');
    setMsg('');
    try {
      const r = await fetch('/api/indicators/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not read the description.');
      if (d.unsupported) { setSpec(null); setMsg(d.unsupported); setQuestions(d.questions || []); return; }
      setSpec(d.spec);
      setSavedId(null);
      setQuestions(d.questions || []);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy((b) => (b === 'parse' ? '' : b));
    }
  }

  const upd = (p: Partial<IndicatorSpec>) => setSpec((s) => sanitizeIndicator({ ...(s || DEFAULT_INDICATOR), ...p }));
  const sig = spec?.signals;
  const updSig = (p: Partial<NonNullable<IndicatorSpec['signals']>>) => spec && upd({ signals: { ...(sig || DEFAULT_INDICATOR.signals!), ...p } });

  const pine = spec ? toPineIndicator(spec) : '';
  const mql5 = spec ? toMql5Indicator(spec) : '';
  const fileBase = (spec?.name || 'markiq-indicator').replace(/[^\w-]+/g, '_');

  async function copyForTradingView() {
    try {
      await navigator.clipboard.writeText(pine);
      setCopied('Copied. In TradingView, open the Pine Editor at the bottom, select all, paste, then press "Add to chart".');
    } catch {
      setShow('pine');
      setCopied('Your browser blocked copying. The code is shown below: select it all and copy it.');
    }
    window.open('https://www.tradingview.com/chart/', '_blank', 'noopener');
  }

  async function save() {
    if (!spec) return;
    if (!signedIn) { try { localStorage.setItem('mq_next', '/tools?tool=indicator'); } catch {} window.location.href = '/get-started'; return; }
    setSaved('');
    const r = await fetch('/api/indicators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: savedId, spec, description: text }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return setSaved(d.error || 'Could not save.');
    setSavedId(d.id);
    setSaved('Saved to your account.');
    fetch('/api/indicators').then((x) => x.json()).then((x) => x.ok && setMine(x.indicators)).catch(() => {});
  }

  const box = { background: '#F6F1E9', borderRadius: 18, padding: 18 } as const;

  return (
    <div className="stack" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 34, padding: 'clamp(22px, 4vw, 48px)', gap: 30 }}>
      <div className="stack" style={{ gap: 12, maxWidth: 860 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}><h2 className="h2">Indicator Builder</h2><span className="chip chip-amber">Beta</span></div>
        <p className="lead" style={{ margin: 0 }}>Describe the indicator you want in plain words. See it on a real chart with years of history, then add it to TradingView or MT5. No coding, no account needed.</p>
      </div>

      <div className="row" style={{ gap: 28, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 12 }}>
          <label htmlFor="ib-text" style={{ fontWeight: 700, fontSize: 18 }}>1 · Describe your indicator</label>
          <textarea id="ib-text" rows={5} value={text} maxLength={2000} onChange={(ev) => setText(ev.target.value)} className="textarea" style={{ padding: 16, minHeight: 140, resize: 'vertical' }} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {INDICATOR_EXAMPLES.slice(1).map((ex) => (
              <button key={ex} type="button" className="toggle" style={{ fontSize: 14, textAlign: 'left' }} onClick={() => setText(ex)}>{ex.length > 60 ? ex.slice(0, 58) + '…' : ex}</button>
            ))}
          </div>
          <span className="faint" style={{ fontSize: 14 }}>Lines: EMA, SMA, Bollinger Bands, Supertrend, Donchian. Lower panel: RSI, MACD, Stochastic. Arrows: any Bot Builder signal, such as crosses, supply and demand, fair value gaps, order blocks, BOS, liquidity sweeps and candle patterns, with confirmation, trend and session filters.</span>
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={build} disabled={busy === 'parse'}>
            {busy === 'parse' ? <span className="spinner" aria-label="Reading" /> : 'Build my indicator'} <span className="arr" aria-hidden="true">»</span>
          </button>
          {msg && <div role="alert" className="note note-warn">{msg}</div>}
          {signedIn && mine.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Your saved indicators</span>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {mine.map((m) => <button key={m.id} type="button" className="toggle" onClick={() => { setSpec(sanitizeIndicator(m.spec)); setSavedId(m.id); setText(m.description || text); setQuestions([]); }}>{m.name}</button>)}
              </div>
            </div>
          )}
        </div>

        <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>2 · What it will draw</span>
          {!spec ? (
            <div style={{ ...box, color: '#4A5873' }}>Press &quot;Build my indicator&quot; to see how we read your description.</div>
          ) : (
            <>
              <div className="stack" style={{ ...box, gap: 10, color: '#0B1A36' }}>
                {describeIndicator(spec).map((r) => (
                  <div key={r.k + r.v} className="row" style={{ justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #E2DACB', paddingBottom: 8 }}>
                    <span style={{ color: '#4A5873' }}>{r.k}</span><span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '65%' }}>{r.v}</span>
                  </div>
                ))}
                {questions.map((q) => <span key={q} style={{ fontSize: 15, color: '#6B3E00', background: '#FFE2B0', borderRadius: 12, padding: '10px 12px' }}>{q} You can change it below.</span>)}
              </div>
              <details style={{ ...box, color: '#0B1A36' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Change it</summary>
                <div className="stack" style={{ gap: 14, marginTop: 14 }}>
                  <label className="field">Name<input className="input" value={spec.name} onChange={(ev) => upd({ name: ev.target.value })} /></label>
                  <span style={{ fontWeight: 600 }}>Lines on the price chart</span>
                  {spec.lines.map((l, i) => (
                    <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                      <label className="field" style={{ flex: 2 }}>Type<select className="input select" value={l.type} onChange={(ev) => upd({ lines: spec.lines.map((x, k) => (k === i ? { ...x, type: ev.target.value as LineType } : x)) })}>{(Object.keys(LINE_LABEL) as LineType[]).map((k) => <option key={k} value={k}>{LINE_LABEL[k]}</option>)}</select></label>
                      <label className="field" style={{ flex: 1 }}>Length<input className="input" type="number" value={l.length} onChange={(ev) => upd({ lines: spec.lines.map((x, k) => (k === i ? { ...x, length: +ev.target.value } : x)) })} /></label>
                      {(l.type === 'bb' || l.type === 'supertrend') && <label className="field" style={{ flex: 1 }}>{l.type === 'bb' ? 'Deviation' : 'Factor'}<input className="input" type="number" step="0.1" value={l.mult} onChange={(ev) => upd({ lines: spec.lines.map((x, k) => (k === i ? { ...x, mult: +ev.target.value } : x)) })} /></label>}
                      <button type="button" className="toggle" aria-label="Remove line" onClick={() => upd({ lines: spec.lines.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                  ))}
                  {spec.lines.length < 6 && <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ lines: [...spec.lines, { type: 'ema', length: 100, mult: 2 }] })}>+ Add a line</button>}
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    <label className="field">Lower panel<select className="input select" value={spec.panel.type} onChange={(ev) => upd({ panel: { ...spec.panel, type: ev.target.value as PanelType } })}>{(Object.keys(PANEL_LABEL) as PanelType[]).map((k) => <option key={k} value={k}>{PANEL_LABEL[k]}</option>)}</select></label>
                    {(spec.panel.type === 'rsi' || spec.panel.type === 'stoch') && <>
                      <label className="field">Length<input className="input" type="number" value={spec.panel.length} onChange={(ev) => upd({ panel: { ...spec.panel, length: +ev.target.value } })} /></label>
                      <label className="field">Low level<input className="input" type="number" value={spec.panel.lower} onChange={(ev) => upd({ panel: { ...spec.panel, lower: +ev.target.value } })} /></label>
                      <label className="field">High level<input className="input" type="number" value={spec.panel.upper} onChange={(ev) => upd({ panel: { ...spec.panel, upper: +ev.target.value } })} /></label>
                    </>}
                  </div>
                  <span style={{ fontWeight: 600 }}>Buy and sell arrows</span>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <label className="field">Arrow when<select className="input select" value={sig?.entry.kind || ''} onChange={(ev) => (ev.target.value ? updSig({ entry: { ...(sig?.entry || DEFAULT_INDICATOR.signals!.entry), kind: ev.target.value as EntryKind } }) : upd({ signals: null }))}><option value="">No arrows</option>{ENTRY_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((i) => <option key={i.kind} value={i.kind}>{i.label}</option>)}</optgroup>)}</select></label>
                    {sig && <>
                      <label className="field">Only after<select className="input select" value={sig.confirm?.kind || ''} onChange={(ev) => updSig({ confirm: ev.target.value ? { kind: ev.target.value as EntryKind, within: sig.confirm?.within || 10 } : null })}><option value="">Nothing</option>{ENTRY_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.filter((i) => i.kind !== sig.entry.kind).map((i) => <option key={i.kind} value={i.kind}>{i.label}</option>)}</optgroup>)}</select></label>
                      {(sig.entry.kind === 'ema_cross' || sig.entry.kind === 'sma_cross') && <>
                        <label className="field">Fast<input className="input" type="number" value={sig.entry.fast} onChange={(ev) => updSig({ entry: { ...sig.entry, fast: +ev.target.value } })} /></label>
                        <label className="field">Slow<input className="input" type="number" value={sig.entry.slow} onChange={(ev) => updSig({ entry: { ...sig.entry, slow: +ev.target.value } })} /></label>
                      </>}
                      {sig.entry.kind === 'rsi' && <>
                        <label className="field">RSI length<input className="input" type="number" value={sig.entry.period} onChange={(ev) => updSig({ entry: { ...sig.entry, period: +ev.target.value } })} /></label>
                        <label className="field">Buy below<input className="input" type="number" value={sig.entry.lower} onChange={(ev) => updSig({ entry: { ...sig.entry, lower: +ev.target.value } })} /></label>
                        <label className="field">Sell above<input className="input" type="number" value={sig.entry.upper} onChange={(ev) => updSig({ entry: { ...sig.entry, upper: +ev.target.value } })} /></label>
                      </>}
                      <label className="field">Direction<select className="input select" value={sig.direction} onChange={(ev) => updSig({ direction: ev.target.value as Rules['direction'] })}><option value="both">Buy and sell</option><option value="long">Buy only</option><option value="short">Sell only</option></select></label>
                      <label className="field">Trend filter<select className="input select" value={sig.trendFilter} onChange={(ev) => updSig({ trendFilter: ev.target.value as Rules['trendFilter'] })}><option value="none">None</option><option value="ema200">Only with the 200 EMA trend</option></select></label>
                      <label className="field">Session<select className="input select" value={sig.session} onChange={(ev) => updSig({ session: ev.target.value as Rules['session'] })}><option value="any">Any time</option><option value="london">London (07–16 UTC)</option><option value="newyork">New York (12–21 UTC)</option><option value="london_ny">London + New York</option></select></label>
                      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={spec.alerts} onChange={(ev) => upd({ alerts: ev.target.checked })} /> Alerts on arrows</label>
                    </>}
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {spec && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>3 · See it on a real chart</span>
            <div className="row" style={{ gap: 8 }}>
              <select className="select-pill" aria-label="Market" value={sym} onChange={(ev) => setSym(ev.target.value)}>{SYMBOLS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <select className="select-pill" aria-label="Timeframe" value={tf} onChange={(ev) => setTf(ev.target.value as TF)}>{TIMEFRAMES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
            </div>
          </div>
          {chartErr && <div role="alert" className="note note-bad">{chartErr}</div>}
          {busy === 'chart' && <div className="note note-info" role="status"><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, verticalAlign: 'middle', marginRight: 8 }} />Loading real price history…</div>}
          {candles.length > 0 && <PreviewChart candles={candles} spec={spec} symbol={sym} />}
        </div>
      )}

      {spec && (
        <div className="stack" style={{ gap: 14 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>4 · Add it to your platform</span>
          <div className="grid g-2">
            <div className="card stack" style={{ gap: 10 }}>
              <strong style={{ fontSize: 19 }}>TradingView</strong>
              <span className="muted">Copies the Pine Script and opens TradingView. Paste it into the Pine Editor and press &quot;Add to chart&quot; to test it there too.</span>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={copyForTradingView}>Copy and open TradingView</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => download(`${fileBase}.pine`, pine)}>Download .pine</button>
              </div>
              {copied && <span role="status" style={{ fontSize: 15 }}>{copied}</span>}
            </div>
            <div className="card stack" style={{ gap: 10 }}>
              <strong style={{ fontSize: 19 }}>MetaTrader 5</strong>
              <span className="muted">Download the indicator file. In MT5: File → Open Data Folder → MQL5 → Indicators, put the file there, open it in MetaEditor and press Compile. Then drag it onto a chart.</span>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => download(`${fileBase}.mq5`, mql5)}>Download MT5 indicator (.mq5)</button>
              </div>
              {spec.panel.type !== 'none' && <span className="faint" style={{ fontSize: 14 }}>MT5 draws the lower panel with its own built-in {PANEL_LABEL[spec.panel.type]}; the file explains the settings.</span>}
            </div>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <button type="button" className="linkbtn" onClick={() => setShow(show === 'pine' ? '' : 'pine')}>{show === 'pine' ? 'Hide' : 'Show'} TradingView code</button>
            <button type="button" className="linkbtn" onClick={() => setShow(show === 'mql5' ? '' : 'mql5')}>{show === 'mql5' ? 'Hide' : 'Show'} MT5 code</button>
            <button type="button" className="linkbtn" onClick={save}>{signedIn ? (savedId ? 'Save changes' : 'Save to my account') : 'Create a free account to save'}</button>
          </div>
          {saved && <span role="status">{saved}</span>}
          {show && <pre className="code">{show === 'pine' ? pine : mql5}</pre>}
          <p className="faint" style={{ margin: 0, fontSize: 14 }}>
            An indicator shows information, it does not trade. Arrows on past candles do not guarantee future results. Want it to trade? Build the same rules in the <Link href="/tools?tool=bot">Bot Builder</Link> and backtest it first.
          </p>
        </div>
      )}
    </div>
  );
}
