'use client';

import { useEffect, useRef, useState } from 'react';
import { ChartLab } from './ChartLab';
import { SYMBOLS } from '@/lib/trading/symbols';

const SYMS = [
  ['FX:EURUSD', 'EUR/USD'], ['FX:GBPUSD', 'GBP/USD'], ['FX:USDJPY', 'USD/JPY'], ['OANDA:XAUUSD', 'Gold'], ['TVC:USOIL', 'Oil'],
  ['SP:SPX', 'S&P 500'], ['NASDAQ:NDX', 'Nasdaq 100'], ['BITSTAMP:BTCUSD', 'Bitcoin'], ['BITSTAMP:ETHUSD', 'Ethereum'],
];

export function Charts({ initial }: { initial?: string }) {
  const [tab, setTab] = useState<'replay' | 'live'>('replay');
  const [sym, setSym] = useState(SYMBOLS.find((x) => x.key === initial)?.tv || 'FX:EURUSD');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || tab !== 'live') return;
    el.innerHTML = '';
    const dark = document.documentElement.dataset.theme === 'dark';
    const w = document.createElement('div');
    w.className = 'tradingview-widget-container__widget';
    w.style.height = '100%';
    el.appendChild(w);
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol: sym,
      interval: '60',
      timezone: 'Africa/Lagos',
      theme: dark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      withdateranges: true,
      hide_side_toolbar: false,
      details: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(s);
  }, [sym, tab]);
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
      {tab === 'replay' ? (
        <ChartLab initialSymbol={initial} />
      ) : (
        <>
          <div className="row" role="group" aria-label="Market" style={{ gap: 8 }}>
            {SYMS.map(([k, l]) => <button key={k} type="button" className="toggle" aria-pressed={sym === k} onClick={() => setSym(k)}>{l}</button>)}
          </div>
          <div ref={box} className="tradingview-widget-container" style={{ height: 'min(78vh, 720px)', minHeight: 460, borderRadius: 22, overflow: 'hidden', background: 'var(--inset)' }} />
          <span className="small faint">Live chart provided by TradingView. Prices can be delayed depending on the market.</span>
        </>
      )}
    </div>
  );
}
