'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { GROUPS, STRATEGIES, TIMEFRAMES } from '@/lib/trading/symbols';

type Row = { setup_key: string; symbol: string; htfLabel: string; htfTrend: string; htfAgrees: boolean; label: string; tfLabel: string; direction: string; strategyLabel: string; strength: number; detail: string; news: string; bias: string; bar_time: string; tv: string };

const GROUP_ORDER = ['Price action', 'ICT & SMC', 'Classic indicators'];

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

export function MarketScanner({ signedIn, onOpenChart }: { signedIn: boolean; onOpenChart: (symbol: string) => void }) {
  const [markets, setMarkets] = useState<string[]>([...GROUPS]);
  const [tfSel, setTfSel] = useState<string[]>(['1h', '4h', '1day']);
  const [confirm, setConfirm] = useState(false);
  const [strats, setStrats] = useState<string[]>(['sd', 'candles', 'fvg', 'bos']);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; series: number; mineNote: string; fastNote: string }>({ updatedAt: null, series: 0, mineNote: '', fastNote: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ on: boolean; telegram: boolean } | null>(null);
  const [alertMsg, setAlertMsg] = useState('');

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const tfs = tfSel;

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const u = new URLSearchParams({ markets: markets.join(','), tf: tfs.join(','), strategies: strats.join(','), confirm: confirm ? '1' : '0' });
      const r = await fetch(`/api/scanner?${u}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(`${d.error || 'Could not load the scanner.'}${d.detail ? ` (Reason: ${d.detail})` : ''}`);
      setRows(d.results);
      setMeta({ updatedAt: d.updatedAt, series: d.series, mineNote: d.mineNote, fastNote: d.fastNote || '' });
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets.join(), tfSel.join(), strats.join(), confirm]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/scanner/alerts').then((r) => r.json()).then((d) => {
      if (d.signedIn) {
        setAlert({ on: !!d.alert?.active, telegram: !!d.telegram });
        if (d.alert?.active) {
          setMarkets(d.alert.markets);
          setStrats(d.alert.strategies);
          setTfSel(d.alert.timeframes);
        }
      }
    }).catch(() => {});
  }, []);

  async function saveAlert(on: boolean) {
    setAlertMsg('');
    if (!signedIn) { window.location.href = '/get-started'; return; }
    const r = await fetch('/api/scanner/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markets, timeframes: tfs, strategies: strats, active: on }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return setAlertMsg(d.error || 'Could not save.');
    setAlert({ on, telegram: !!d.telegram });
  }

  const label = (k: string) => STRATEGIES.find((s) => s.key === k)?.label || 'My strategy';

  return (
    <div className="card-lg stack" style={{ gap: 26 }}>
      <div className="stack" style={{ gap: 12, maxWidth: 880 }}>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}><h2 className="h2">Market Scanner</h2><span className="chip chip-amber">Beta</span></div>
        <p style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Scan forex, gold, oil, indices and crypto for the strategies you trade, from supply and demand to ICT and SMC setups. Every result also shows the news coming up and the interest-rate picture, and you can get a Telegram alert when a new setup appears.</p>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <span className="label" style={{ fontSize: 18 }}>1 · Markets</span>
        <div className="row" style={{ gap: 8 }} role="group" aria-label="Markets">
          {GROUPS.map((m) => <button key={m} type="button" className="toggle" aria-pressed={markets.includes(m)} onClick={() => setMarkets(toggle(markets, m))}>{m}</button>)}
        </div>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <span className="label" style={{ fontSize: 18 }}>2 · Timeframes <span className="faint" style={{ fontWeight: 500, fontSize: 15 }}>(pick one or more, from 1 minute to monthly)</span></span>
        <div className="row" style={{ gap: 8, alignItems: 'center' }} role="group" aria-label="Timeframes">
          {TIMEFRAMES.map((t) => <button key={t.key} type="button" className="toggle" aria-pressed={tfSel.includes(t.key)} onClick={() => setTfSel(toggle(tfSel, t.key).length ? toggle(tfSel, t.key) : tfSel)}>{t.label}</button>)}
          <button type="button" className="linkbtn" onClick={() => setTfSel(TIMEFRAMES.map((t) => t.key))}>All</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: 20, height: 20, accentColor: '#1A5FD0' }} />
          <span><strong>Only show setups the higher timeframe agrees with</strong> <span className="faint small">(for example a 15m buy only if the 1H trend is up)</span></span>
        </label>
        <span className="small faint">1m to 30m charts load when you scan them, so they can take a minute the first time.</span>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <span className="label" style={{ fontSize: 18 }}>3 · Strategies <span className="faint" style={{ fontWeight: 500, fontSize: 15 }}>(pick as many as you like)</span></span>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14 }}>
          {[...GROUP_ORDER, 'Your own'].map((g) => (
            <div key={g} className="inset stack" style={{ gap: 10, borderRadius: 22 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>{g}</span>
              {(g === 'Your own' ? [{ key: 'mine', label: 'My strategy', desc: 'The rules you saved in the Bot Builder.' }] : STRATEGIES.filter((s) => s.group === g)).map((s) => {
                const on = strats.includes(s.key);
                return (
                  <button key={s.key} type="button" aria-pressed={on} onClick={() => setStrats(toggle(strats, s.key))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', minHeight: 44, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', background: on ? 'var(--ink)' : 'var(--surface)', color: on ? 'var(--bg)' : 'var(--ink)', border: `1px solid ${on ? 'var(--ink)' : 'var(--line-soft)'}` }}>
                    <span style={{ fontWeight: 700 }}>{on ? '✓' : '+'} {s.label}</span>
                    <span style={{ fontSize: 14, opacity: 0.75 }}>{s.desc}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 28 }} aria-live="polite">{busy ? 'Scanning…' : rows ? `${rows.length} setup${rows.length === 1 ? '' : 's'} found` : ''}</span>
          <span className="small faint">{meta.updatedAt ? `Prices updated ${ago(meta.updatedAt)}` : ''}</span>
        </div>
        {meta.fastNote && <div className="note note-info">{meta.fastNote}</div>}
        {meta.mineNote && <div className="note note-info">{meta.mineNote} <Link href="/tools?tool=bot">Open the Bot Builder</Link></div>}
        {err && <div role="alert" className="note note-bad">{err}</div>}
        {rows?.map((r) => (
          <article key={r.setup_key} className="row" style={{ border: '1px solid var(--line-soft)', borderRadius: 22, padding: '18px 22px', gap: '14px 26px', alignItems: 'center' }}>
            <div className="stack" style={{ flex: '0 0 160px', gap: 4 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{r.label}</span>
              <span className="mono faint" style={{ fontSize: 14 }}>{r.tfLabel} · {ago(r.bar_time)}</span>
            </div>
            <div className="stack" style={{ flex: '1 1 360px', minWidth: 0, gap: 6 }}>
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className={`chip ${r.direction === 'Bullish' ? 'chip-bull' : 'chip-bear'}`}>{r.direction}</span>
                <span className="chip chip-blue">{r.strategyLabel}</span>
                <span style={{ display: 'inline-flex', gap: 3 }} aria-label={`Strength ${r.strength} of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ width: 8, height: 14, borderRadius: 2, background: i < r.strength ? '#1A5FD0' : 'var(--line-soft)' }} />)}
                </span>
              </div>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{r.detail}</span>
              {r.news && <span className="note note-bad" style={{ alignSelf: 'flex-start', padding: '6px 10px', fontSize: 15 }}><strong>News ahead:</strong> {r.news}</span>}
              {r.bias && <span style={{ fontSize: 15, color: 'var(--text)' }}><strong style={{ color: 'var(--ink)' }}>Fundamentals:</strong> {r.bias}</span>}
              {r.htfLabel && <span style={{ fontSize: 15, color: r.htfAgrees ? '#0B8A55' : 'var(--text)' }}><strong style={{ color: 'var(--ink)' }}>{r.htfLabel} trend:</strong> {r.htfTrend === 'unknown' ? 'not loaded yet' : r.htfTrend}{r.htfAgrees ? ' ✓ agrees' : r.htfTrend === 'unknown' || r.htfTrend === 'flat' ? '' : ' (against this setup)'}</span>}
            </div>
            <div className="row" style={{ flex: '0 1 220px', gap: 8 }}>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44, fontSize: 15 }} onClick={() => onOpenChart(r.symbol)}>Open chart</button>
            </div>
          </article>
        ))}
        {rows && rows.length === 0 && !err && (
          <div className="empty">{meta.series === 0 ? 'The scanner is loading price data for the first time. Results appear within the hour. Please check back soon.' : 'No setups match right now. Try more markets, another timeframe or more strategies.'}</div>
        )}
      </div>

      <div className="row on-navy" style={{ background: '#0B1A36', color: '#FFFFFF', borderRadius: 26, padding: '26px 28px', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
        <div className="stack" style={{ flex: '1 1 420px', gap: 6 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>Get this scan on Telegram</span>
          <span style={{ color: '#B9C9E6' }}>
            {alert?.on ? `Alerts are on: ${strats.map(label).join(', ') || 'no strategies picked'} on ${tfSel.map((k) => TIMEFRAMES.find((t) => t.key === k)?.label).join(', ')}.` : 'Get a message on Telegram the moment a new setup matches your markets, timeframe and strategies.'}
            {alert?.on && !alert.telegram && <> <Link href="/account#telegram" style={{ color: '#FFB547' }}>Connect Telegram</Link> to receive them.</>}
          </span>
          {alertMsg && <span role="alert" style={{ color: '#FFB4A0' }}>{alertMsg}</span>}
        </div>
        <div className="row" style={{ gap: 10 }}>
          {alert?.on && <button type="button" className="btn btn-ghost-light btn-sm" onClick={() => saveAlert(false)}>Turn off</button>}
          <button type="button" className="btn btn-amber" onClick={() => saveAlert(true)}>{alert?.on ? 'Update alerts' : 'Turn on Telegram alerts'}</button>
        </div>
      </div>
      <span className="small faint">Scans use finished candles only. 1H to monthly charts refresh automatically through the day; 1m to 30m refresh when you scan them. A setup is not a signal to buy or sell. ICT, SMC and zone setups are found with fixed rules, so they can differ a little from how you would mark them by hand.</span>
    </div>
  );
}
