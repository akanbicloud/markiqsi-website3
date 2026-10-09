'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_RULES, ENTRY_GROUPS, ENTRY_LABEL, PRESETS, TIMEFRAME_LABEL, describeRules, sanitizeRules, type EntryKind, type Rules, type Timeframe } from '@/lib/trading/botspec';
import { toMql5 } from '@/lib/trading/codegen-mql5';
import { toPine } from '@/lib/trading/codegen-pine';
import { BacktestReplay, BacktestReport, type BTData } from './BacktestShow';


const EXAMPLE = 'Trade EURUSD on the 15-minute chart. After a liquidity sweep, enter on the fair value gap, only during London and New York, and only with the 200 EMA trend. Stop loss 15 pips, take profit 30 pips. Risk 1% per trade.';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BotBuilder({ signedIn }: { signedIn: boolean }) {
  const [text, setText] = useState(EXAMPLE);
  const [rules, setRules] = useState<Rules | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [bt, setBt] = useState<BTData | null>(null);
  const [phase, setPhase] = useState<'replay' | 'report'>('replay');
  const [run, setRun] = useState(0);
  const rulesBox = useRef<HTMLDetailsElement>(null);
  const testBox = useRef<HTMLDivElement>(null);
  const [btErr, setBtErr] = useState('');
  const [show, setShow] = useState<'' | 'mql5' | 'pine'>('');
  const [botId, setBotId] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  const [bots, setBots] = useState<{ id: number; name: string; rules: Rules; description: string }[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/bots').then((r) => r.json()).then((d) => d.ok && setBots(d.bots)).catch(() => {});
  }, [signedIn]);

  async function check() {
    setBusy('parse');
    setMsg('');
    setBt(null);
    try {
      const r = await fetch('/api/bots/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not read the strategy.');
      if (d.unsupported) { setRules(null); setMsg(d.unsupported); return; }
      setRules(d.rules);
      setQuestions(d.questions || []);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  function upd(p: Partial<Rules>) { setRules(sanitizeRules({ ...(rules || DEFAULT_RULES), ...p })); setBt(null); }
  function updEntry(p: Partial<Rules['entry']>) { const r = rules || DEFAULT_RULES; upd({ entry: { ...r.entry, ...p } }); }

  async function runBacktest() {
    if (!rules) return;
    setBusy('bt');
    setBtErr('');
    try {
      const r = await fetch('/api/bots/backtest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'The backtest could not run.');
      setBt(d as BTData);
      setPhase('replay');
      setRun((n) => n + 1);
      requestAnimationFrame(() => testBox.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    } catch (e) {
      setBtErr((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!rules) return;
    if (!signedIn) { window.location.href = '/get-started'; return; }
    setSaved('');
    const r = await fetch('/api/bots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: botId, rules, description: text }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return setSaved(d.error || 'Could not save.');
    setBotId(d.id);
    setSaved('Saved to your account. You can also scan it in the Market Scanner under "My strategy".');
    fetch('/api/bots').then((x) => x.json()).then((x) => x.ok && setBots(x.bots)).catch(() => {});
  }

  const fileBase = (rules?.name || 'markiq-bot').replace(/[^\w-]+/g, '_');
  const code = rules ? (show === 'mql5' ? toMql5(rules) : show === 'pine' ? toPine(rules) : '') : '';
  const e = rules?.entry;

  return (
    <div className="stack on-navy" style={{ background: '#0B1A36', color: '#FFFFFF', borderRadius: 34, padding: 'clamp(24px, 4vw, 56px)', gap: 34 }}>
      <div className="stack" style={{ gap: 14, maxWidth: 860 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}><h2 className="h2">Bot Builder</h2><span className="chip chip-amber">Beta</span></div>
        <p style={{ margin: 0, fontSize: 20, color: '#B9C9E6' }}>Describe your strategy in plain words. We turn it into a working bot, test it on past data, then you run it on a demo account and, when you are ready, on your own MT5.</p>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {[['1', 'Describe it', 'Write your strategy like you would explain it to a friend.'], ['2', 'Check the rules', 'See the exact rules we understood and fix anything unclear.'], ['3', 'Get your bot', 'Download it for MT5 or copy it into TradingView, with safety limits built in.'], ['4', 'Test it', 'Backtest on past data, then run it on a demo account for a few weeks.'], ['5', 'Go live on MT5', 'When results hold up, run it on your own MT5, starting small.']].map(([n, t, x]) => (
          <div key={n} className="glass stack" style={{ gap: 6 }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 36, color: '#FFB547' }}>{n}</span>
            <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>{t}</span>
            <span style={{ fontSize: 15, color: '#B9C9E6' }}>{x}</span>
          </div>
        ))}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>Start from a ready-made strategy</span>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="glass stack lift" style={{ gap: 6, textAlign: 'left', color: '#FFFFFF', cursor: 'pointer', padding: 18 }} onClick={() => { const r = sanitizeRules({ ...DEFAULT_RULES, ...p.rules, entry: { ...DEFAULT_RULES.entry, ...(p.rules.entry || {}) } as Rules['entry'] }); setRules(r); setQuestions([]); setBt(null); setMsg(''); setBotId(null); setText(`${p.name}: ${p.desc}`); }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 19 }}>{p.name}</span>
              <span style={{ fontSize: 14, color: '#B9C9E6' }}>{p.desc}</span>
            </button>
          ))}
        </div>
        <span style={{ fontSize: 15, color: '#B9C9E6' }}>Or describe your own strategy below. You can mix them, for example “after a liquidity sweep, enter on the fair value gap in the London session, only with the 200 EMA trend”.</span>
      </div>

      <div className="row" style={{ background: '#FFFFFF', color: '#0B1A36', borderRadius: 30, padding: 'clamp(22px, 3vw, 36px)', gap: 28 }}>
        <div className="stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 12 }}>
          <label htmlFor="bb-text" style={{ fontWeight: 700, fontSize: 18 }}>1 · Describe your strategy</label>
          <textarea id="bb-text" rows={6} value={text} maxLength={3000} onChange={(ev) => setText(ev.target.value)} style={{ padding: 16, borderRadius: 16, border: '1px solid #D8D0C1', background: '#F6F1E9', color: '#0B1A36', fontSize: 17, resize: 'vertical' }} />
          <span style={{ fontSize: 14, color: '#5A6780' }}>Understands supply and demand, support and resistance, candle patterns, fair value gaps, order blocks, BOS/CHoCH, liquidity sweeps, OTE, London breakout, inside bars, trend pullbacks, EMA/SMA crosses, RSI, MACD, Bollinger Bands, Stochastic, Supertrend and breakouts, on any chart from 1 minute to monthly. You can add a confirmation, a 200 EMA trend filter and a session filter.</span>
          <button type="button" onClick={check} disabled={busy === 'parse'} className="btn" style={{ alignSelf: 'flex-start', background: '#0B1A36', color: '#FFFFFF' }}>
            {busy === 'parse' ? <span className="spinner" aria-label="Reading" /> : 'Check my rules'} <span aria-hidden="true" style={{ color: '#FFB547' }}>»</span>
          </button>
          {signedIn && bots.length > 0 && (
            <div className="stack" style={{ gap: 6, marginTop: 6 }}>
              <span style={{ fontWeight: 600 }}>Your saved bots</span>
              <div className="row" style={{ gap: 8 }}>
                {bots.map((b) => (
                  <button key={b.id} type="button" className="toggle" style={{ background: '#F6F1E9', color: '#0B1A36', borderColor: '#D8D0C1' }} onClick={() => { setRules(sanitizeRules(b.rules)); setBotId(b.id); setText(b.description || text); setQuestions([]); setBt(null); setMsg(''); }}>{b.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>2 · Rules we understood</span>
          {!rules ? (
            <div style={{ background: '#F6F1E9', borderRadius: 18, padding: 22, color: '#4A5873' }}>{msg || 'Press "Check my rules" to see how we read your strategy.'}</div>
          ) : (
            <>
              <div className="stack" style={{ background: '#F6F1E9', borderRadius: 18, padding: 18, gap: 10 }}>
                {describeRules(rules).map((r) => (
                  <div key={r.k} className="row" style={{ justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #E2DACB', paddingBottom: 8 }}>
                    <span style={{ color: '#4A5873' }}>{r.k}</span><span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '65%' }}>{r.v}</span>
                  </div>
                ))}
                {questions.map((q) => <span key={q} style={{ fontSize: 15, color: '#6B3E00', background: '#FFE2B0', borderRadius: 12, padding: '10px 12px' }}>{q} You can change it below.</span>)}
              </div>
              <details ref={rulesBox} style={{ background: '#F6F1E9', borderRadius: 18, padding: '14px 18px', scrollMarginTop: 20 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Change the rules</summary>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
                  <label className="field">Bot name<input className="input" value={rules.name} onChange={(ev) => upd({ name: ev.target.value })} /></label>
                  <label className="field">Market<input className="input" value={rules.symbol} onChange={(ev) => upd({ symbol: ev.target.value })} /></label>
                  <label className="field">Timeframe<select className="input select" value={rules.timeframe} onChange={(ev) => upd({ timeframe: ev.target.value as Timeframe })}>{(Object.keys(TIMEFRAME_LABEL) as Timeframe[]).map((k) => <option key={k} value={k}>{TIMEFRAME_LABEL[k]}</option>)}</select></label>
                  <label className="field">Entry<select className="input select" value={rules.entry.kind} onChange={(ev) => upd({ entry: { ...rules.entry, kind: ev.target.value as EntryKind } })}>{ENTRY_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((i) => <option key={i.kind} value={i.kind}>{i.label}</option>)}</optgroup>)}</select></label>
                  <label className="field">Confirmation<select className="input select" value={rules.confirm?.kind || ''} onChange={(ev) => upd({ confirm: ev.target.value ? { kind: ev.target.value as EntryKind, within: rules.confirm?.within || 10 } : null })}><option value="">None</option>{ENTRY_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.filter((i) => i.kind !== rules.entry.kind).map((i) => <option key={i.kind} value={i.kind}>{i.label}</option>)}</optgroup>)}</select></label>
                  {rules.confirm && <label className="field">Within (candles)<input className="input" type="number" value={rules.confirm.within} onChange={(ev) => upd({ confirm: { ...rules.confirm!, within: +ev.target.value } })} /></label>}
                  <label className="field">Trend filter<select className="input select" value={rules.trendFilter} onChange={(ev) => upd({ trendFilter: ev.target.value as Rules['trendFilter'] })}><option value="none">None</option><option value="ema200">Only with the 200 EMA trend</option></select></label>
                  <label className="field">Session<select className="input select" value={rules.session} onChange={(ev) => upd({ session: ev.target.value as Rules['session'] })}><option value="any">Any time</option><option value="london">London (07–16 UTC)</option><option value="newyork">New York (12–21 UTC)</option><option value="london_ny">London + New York (07–21 UTC)</option></select></label>
                  {(e?.kind === 'ema_cross' || e?.kind === 'sma_cross') && <><label className="field">Fast<input className="input" type="number" value={e.fast} onChange={(ev) => updEntry({ fast: +ev.target.value })} /></label><label className="field">Slow<input className="input" type="number" value={e.slow} onChange={(ev) => updEntry({ slow: +ev.target.value })} /></label></>}
                  {(e?.kind === 'rsi' || rules.confirm?.kind === 'rsi') && <><label className="field">RSI length<input className="input" type="number" value={e?.period} onChange={(ev) => updEntry({ period: +ev.target.value })} /></label><label className="field">Buy below<input className="input" type="number" value={e?.lower} onChange={(ev) => updEntry({ lower: +ev.target.value })} /></label><label className="field">Sell above<input className="input" type="number" value={e?.upper} onChange={(ev) => updEntry({ upper: +ev.target.value })} /></label></>}
                  {e?.kind === 'breakout' && <label className="field">Candles<input className="input" type="number" value={e.lookback} onChange={(ev) => updEntry({ lookback: +ev.target.value })} /></label>}
                  {(e?.kind === 'bb' || rules.confirm?.kind === 'bb') && <><label className="field">Bollinger length<input className="input" type="number" value={e?.bbPeriod} onChange={(ev) => updEntry({ bbPeriod: +ev.target.value })} /></label><label className="field">Deviation<input className="input" type="number" step="0.1" value={e?.bbDev} onChange={(ev) => updEntry({ bbDev: +ev.target.value })} /></label></>}
                  {(e?.kind === 'stoch' || rules.confirm?.kind === 'stoch') && <><label className="field">Stochastic %K<input className="input" type="number" value={e?.stochK} onChange={(ev) => updEntry({ stochK: +ev.target.value })} /></label><label className="field">%D<input className="input" type="number" value={e?.stochD} onChange={(ev) => updEntry({ stochD: +ev.target.value })} /></label></>}
                  {(e?.kind === 'supertrend' || rules.confirm?.kind === 'supertrend') && <><label className="field">Supertrend ATR<input className="input" type="number" value={e?.stLen} onChange={(ev) => updEntry({ stLen: +ev.target.value })} /></label><label className="field">Factor<input className="input" type="number" step="0.1" value={e?.stMult} onChange={(ev) => updEntry({ stMult: +ev.target.value })} /></label></>}
                  {(e?.kind === 'pullback' || rules.confirm?.kind === 'pullback') && <><label className="field">Trend EMA<input className="input" type="number" value={e?.trendLen} onChange={(ev) => updEntry({ trendLen: +ev.target.value })} /></label><label className="field">Pullback EMA<input className="input" type="number" value={e?.emaLen} onChange={(ev) => updEntry({ emaLen: +ev.target.value })} /></label></>}
                  <label className="field">Trades<select className="input select" value={rules.direction} onChange={(ev) => upd({ direction: ev.target.value as Rules['direction'] })}><option value="both">Buy and sell</option><option value="long">Buy only</option><option value="short">Sell only</option></select></label>
                  <label className="field">Stop loss (pips)<input className="input" type="number" value={rules.stopLossPips} onChange={(ev) => upd({ stopLossPips: +ev.target.value })} /></label>
                  <label className="field">Take profit (pips)<input className="input" type="number" value={rules.takeProfitPips} onChange={(ev) => upd({ takeProfitPips: +ev.target.value })} /></label>
                  <label className="field">Risk %<input className="input" type="number" step="0.1" value={rules.riskPercent} onChange={(ev) => upd({ riskPercent: +ev.target.value })} /></label>
                  <label className="field">Max trades a day<input className="input" type="number" value={rules.maxTradesPerDay} onChange={(ev) => upd({ maxTradesPerDay: +ev.target.value })} /></label>
                  <label className="field">Daily loss limit %<input className="input" type="number" step="0.5" value={rules.dailyLossPercent} onChange={(ev) => upd({ dailyLossPercent: +ev.target.value })} /></label>
                </div>
              </details>
              <span style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>3 · Get your bot</span>
              <div className="row" style={{ gap: 10 }}>
                <button type="button" className="btn btn-sm" style={{ background: '#0B1A36', color: '#FFFFFF' }} onClick={() => download(`${fileBase}.mq5`, toMql5(rules))}>Download MT5 bot (.mq5)</button>
                <button type="button" className="btn btn-sm btn-outline" style={{ color: '#0B1A36', borderColor: '#0B1A36' }} onClick={() => download(`${fileBase}.pine`, toPine(rules))}>Download TradingView script</button>
              </div>
              <div className="row" style={{ gap: 14 }}>
                <button type="button" className="linkbtn" onClick={() => setShow(show === 'mql5' ? '' : 'mql5')}>{show === 'mql5' ? 'Hide' : 'Show'} MT5 code</button>
                <button type="button" className="linkbtn" onClick={() => setShow(show === 'pine' ? '' : 'pine')}>{show === 'pine' ? 'Hide' : 'Show'} TradingView code</button>
                <button type="button" className="linkbtn" onClick={save}>{signedIn ? (botId ? 'Save changes' : 'Save to my account') : 'Log in to save'}</button>
              </div>
              {saved && <span role="status" style={{ fontSize: 15, color: '#0B4A2E' }}>{saved}</span>}
            </>
          )}
        </div>
      </div>

      {code && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>{show === 'mql5' ? 'MT5 (MQL5) code' : 'TradingView (Pine Script v6) code'}</span>
            <button type="button" className="btn btn-sm btn-ghost-light" onClick={() => navigator.clipboard?.writeText(code)}>Copy code</button>
          </div>
          <pre className="code">{code}</pre>
          <span style={{ color: '#B9C9E6', fontSize: 15 }}>{show === 'mql5' ? 'In MT5: File → Open Data Folder → MQL5 → Experts. Put the file there, open it in MetaEditor and press Compile. Then drag the bot onto a DEMO chart first.' : 'In TradingView: open the Pine Editor, paste the code, press "Add to chart", then open the Strategy Tester tab.'}</span>
        </div>
      )}

      {rules && (
        <div ref={testBox} className="stack" style={{ gap: 16, scrollMarginTop: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>4 · Test it on past data</span>
            <button type="button" className="btn btn-amber" onClick={runBacktest} disabled={busy === 'bt'}>{busy === 'bt' ? <span className="spinner" aria-label="Testing" /> : 'Run backtest'} <span className="arr" aria-hidden="true">»</span></button>
          </div>
          {btErr && <div role="alert" className="note note-bad">{btErr}</div>}
          {busy === 'bt' && <div className="bt-card" role="status" style={{ alignItems: 'center', padding: 40 }}><span className="spinner" /><span style={{ fontWeight: 600 }}>Loading years of real price history for {rules.symbol}…</span></div>}
          {bt && busy !== 'bt' && (phase === 'replay'
            ? <BacktestReplay key={run} data={bt} strategy={rules.name} onDone={() => setPhase('report')} />
            : <BacktestReport data={bt} strategy={rules.name} timeframeLabel={TIMEFRAME_LABEL[rules.timeframe]} onReplay={() => { setRun((n) => n + 1); setPhase('replay'); }}
                onChangeRules={() => { if (rulesBox.current) { rulesBox.current.open = true; rulesBox.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
                onDownload={() => download(`${fileBase}.mq5`, toMql5(rules))} />)}
        </div>
      )}

      <div className="row" style={{ gap: 24, alignItems: 'stretch' }}>
        <div className="glass stack" style={{ flex: '1 1 420px', minWidth: 0, gap: 14, borderRadius: 26, padding: 28 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>5 · Go-live checklist</span>
          {['Tested on a demo account for at least 2 to 4 weeks', 'Start with a small trade size', 'Daily loss limit switched on', 'You know how to switch the bot off (remove it from the chart or turn off Algo Trading)'].map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 18 }}><span aria-hidden="true" style={{ flex: 'none', width: 10, height: 10, borderRadius: '50%', background: '#FFB547', marginTop: 9 }} /><span>{c}</span></div>
          ))}
        </div>
        <div className="stack" style={{ flex: '1 1 360px', minWidth: 0, background: '#FFB547', color: '#0B1A36', borderRadius: 26, padding: 28, gap: 12, justifyContent: 'center' }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>Your MT5, your control</span>
          <span style={{ fontSize: 18 }}>Your bot runs inside your own MT5. We never ask for or store your trading password, and you can switch the bot off any time.</span>
          <span style={{ fontWeight: 600 }}>Live trading risks real money. Start small.</span>
        </div>
      </div>
      {!signedIn && <span style={{ color: '#B9C9E6' }}><Link href="/get-started" style={{ color: '#FFB547' }}>Create a free account</Link> to save your bots and scan them in the Market Scanner.</span>}
    </div>
  );
}
