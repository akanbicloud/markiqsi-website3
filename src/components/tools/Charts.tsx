'use client';

import { useEffect, useState } from 'react';
import { ChartLab } from './ChartLab';
import { SYMBOLS } from '@/lib/trading/symbols';

const SYMS = [
  ['FX:EURUSD', 'EUR/USD'], ['FX:GBPUSD', 'GBP/USD'], ['FX:USDJPY', 'USD/JPY'], ['OANDA:XAUUSD', 'Gold'], ['TVC:USOIL', 'Oil'],
  ['SP:SPX', 'S&P 500'], ['NASDAQ:NDX', 'Nasdaq 100'], ['BITSTAMP:BTCUSD', 'Bitcoin'], ['BITSTAMP:ETHUSD', 'Ethereum'],
];

export function Charts({ initial }: { initial?: string }) {
  const [tab, setTab] = useState<'replay' | 'live'>('replay');
  const [note, setNote] = useState('');
  const [sym, setSym] = useState(SYMBOLS.find((x) => x.key === initial)?.tv || 'FX:EURUSD');
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const m = new MutationObserver(read);
    m.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => m.disconnect();
  }, []);
  const tvSrc = 'https://s.tradingview.com/widgetembed/?' + new URLSearchParams({
    symbol: sym,
    interval: '60',
    hidesidetoolbar: '0',
    symboledit: '1',
    saveimage: '1',
    withdateranges: '1',
    studies: '[]',
    theme: dark ? 'dark' : 'light',
    style: '1',
    timezone: 'Africa/Lagos',
    locale: 'en',
    utm_source: 'markiqsi.com',
  }).toString();
  return (
    <div className="card-lg stack" style={{ gap: 22 }}>
      <div className="stack" style={{ gap: 10, maxWidth: 820 }}>
        <h2 className="h2">Charts</h2>
        <p style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>Years of price history on every timeframe from 1 minute to monthly, with bar replay so you can practise on the past. Switch to the live TradingView chart for drawing tools and hundreds of indicators.</p>
      </div>
      <div role="tablist" aria-label="Chart type" className="tabs" style={{ alignSelf: 'flex-start', background: 'var(--inset)' }}>
        <button type="button" role="tab" className="toggle" aria-selected={tab === 'replay'} onClick={() => setTab('replay')}>History &amp; replay</button>
        <button type="button" role="tab" className="toggle" aria-selected={tab === 'live'} onClick={() => setTab('live')}>Live TradingView chart</button>
      </div>
      {note && tab === 'live' && <div className="note note-info">{note}</div>}
      {tab === 'replay' ? (
        <ChartLab initialSymbol={initial} onUnavailable={(why) => { setNote(`${why} Showing the live TradingView chart for now.`); setTab('live'); }} />
      ) : (
        <>
          <div className="row" role="group" aria-label="Market" style={{ gap: 8 }}>
            {SYMS.map(([k, l]) => <button key={k} type="button" className="toggle" aria-pressed={sym === k} onClick={() => setSym(k)}>{l}</button>)}
          </div>
          <div style={{ height: 'min(78vh, 720px)', minHeight: 480, borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line-soft)', background: 'var(--inset)' }}>
            <iframe key={tvSrc} title="Live TradingView chart" src={tvSrc} style={{ width: '100%', height: '100%', border: 0, display: 'block' }} allowFullScreen />
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="small faint">Live chart provided by TradingView. Prices can be delayed depending on the market.</span>
            <a className="btn btn-sm btn-outline" href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`} target="_blank" rel="noopener noreferrer">Open on TradingView <span className="arr" aria-hidden="true">↗</span></a>
          </div>
        </>
      )}
    </div>
  );
}
