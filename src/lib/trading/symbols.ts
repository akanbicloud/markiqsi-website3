export type Group = 'Forex' | 'Gold & Oil' | 'Indices' | 'Crypto';
export type Sym = { key: string; label: string; td: string; group: Group; pip: number; currencies: string[]; tv: string };

/**
 * Markets the scanner covers. `td` is the Twelve Data symbol. If a symbol is not available
 * on your Twelve Data plan, the scanner simply skips it and shows it as unavailable.
 */
export const SYMBOLS: Sym[] = [
  { key: 'EURUSD', label: 'EUR/USD', td: 'EUR/USD', group: 'Forex', pip: 0.0001, currencies: ['EUR', 'USD'], tv: 'FX:EURUSD' },
  { key: 'GBPUSD', label: 'GBP/USD', td: 'GBP/USD', group: 'Forex', pip: 0.0001, currencies: ['GBP', 'USD'], tv: 'FX:GBPUSD' },
  { key: 'USDJPY', label: 'USD/JPY', td: 'USD/JPY', group: 'Forex', pip: 0.01, currencies: ['USD', 'JPY'], tv: 'FX:USDJPY' },
  { key: 'AUDUSD', label: 'AUD/USD', td: 'AUD/USD', group: 'Forex', pip: 0.0001, currencies: ['AUD', 'USD'], tv: 'FX:AUDUSD' },
  { key: 'USDCAD', label: 'USD/CAD', td: 'USD/CAD', group: 'Forex', pip: 0.0001, currencies: ['USD', 'CAD'], tv: 'FX:USDCAD' },
  { key: 'USDCHF', label: 'USD/CHF', td: 'USD/CHF', group: 'Forex', pip: 0.0001, currencies: ['USD', 'CHF'], tv: 'FX:USDCHF' },
  { key: 'NZDUSD', label: 'NZD/USD', td: 'NZD/USD', group: 'Forex', pip: 0.0001, currencies: ['NZD', 'USD'], tv: 'FX:NZDUSD' },
  { key: 'EURJPY', label: 'EUR/JPY', td: 'EUR/JPY', group: 'Forex', pip: 0.01, currencies: ['EUR', 'JPY'], tv: 'FX:EURJPY' },
  { key: 'GBPJPY', label: 'GBP/JPY', td: 'GBP/JPY', group: 'Forex', pip: 0.01, currencies: ['GBP', 'JPY'], tv: 'FX:GBPJPY' },
  { key: 'XAUUSD', label: 'Gold', td: 'XAU/USD', group: 'Gold & Oil', pip: 0.1, currencies: ['USD'], tv: 'OANDA:XAUUSD' },
  { key: 'WTI', label: 'Oil (WTI)', td: 'WTI/USD', group: 'Gold & Oil', pip: 0.01, currencies: ['USD'], tv: 'TVC:USOIL' },
  { key: 'SPY', label: 'S&P 500 (SPY)', td: 'SPY', group: 'Indices', pip: 0.01, currencies: ['USD'], tv: 'AMEX:SPY' },
  { key: 'QQQ', label: 'Nasdaq 100 (QQQ)', td: 'QQQ', group: 'Indices', pip: 0.01, currencies: ['USD'], tv: 'NASDAQ:QQQ' },
  { key: 'DIA', label: 'Dow Jones (DIA)', td: 'DIA', group: 'Indices', pip: 0.01, currencies: ['USD'], tv: 'AMEX:DIA' },
  { key: 'BTCUSD', label: 'BTC/USD', td: 'BTC/USD', group: 'Crypto', pip: 1, currencies: ['USD'], tv: 'BITSTAMP:BTCUSD' },
  { key: 'ETHUSD', label: 'ETH/USD', td: 'ETH/USD', group: 'Crypto', pip: 0.1, currencies: ['USD'], tv: 'BITSTAMP:ETHUSD' },
  { key: 'SOLUSD', label: 'SOL/USD', td: 'SOL/USD', group: 'Crypto', pip: 0.01, currencies: ['USD'], tv: 'COINBASE:SOLUSD' },
];

export const GROUPS: Group[] = ['Forex', 'Gold & Oil', 'Indices', 'Crypto'];

export type TF = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week' | '1month';
/**
 * background: refreshed automatically for every market. The fast timeframes (1m–30m) use a lot of
 * price-data credits, so on the free data plan they are refreshed only when someone scans them
 * (or for every market if SCANNER_FAST=on and your data plan allows it).
 */
export const TIMEFRAMES: { key: TF; label: string; minutes: number; refreshMinutes: number; background: boolean; higher: TF | null }[] = [
  { key: '1min', label: '1m', minutes: 1, refreshMinutes: 1, background: false, higher: '15min' },
  { key: '5min', label: '5m', minutes: 5, refreshMinutes: 5, background: false, higher: '1h' },
  { key: '15min', label: '15m', minutes: 15, refreshMinutes: 15, background: false, higher: '1h' },
  { key: '30min', label: '30m', minutes: 30, refreshMinutes: 30, background: false, higher: '4h' },
  { key: '1h', label: '1H', minutes: 60, refreshMinutes: 60, background: true, higher: '4h' },
  { key: '4h', label: '4H', minutes: 240, refreshMinutes: 240, background: true, higher: '1day' },
  { key: '1day', label: 'Daily', minutes: 1440, refreshMinutes: 720, background: true, higher: '1week' },
  { key: '1week', label: 'Weekly', minutes: 10080, refreshMinutes: 1440, background: true, higher: '1month' },
  { key: '1month', label: 'Monthly', minutes: 43200, refreshMinutes: 4320, background: true, higher: null },
];
export const TF_KEYS = TIMEFRAMES.map((t) => t.key);

export function findSymbol(key: string) {
  const k = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SYMBOLS.find((s) => s.key === k || s.td.replace('/', '') === k);
}

export const STRATEGIES: { key: string; group: string; label: string; desc: string }[] = [
  { key: 'sd', group: 'Price action', label: 'Supply & demand zones', desc: 'Price returns to a zone where a strong move started.' },
  { key: 'sr', group: 'Price action', label: 'Support & resistance', desc: 'Price tests a level it has turned at before.' },
  { key: 'candles', group: 'Price action', label: 'Candle patterns', desc: 'Engulfing, pin bar, hammer, inside bar, morning and evening star.' },
  { key: 'fvg', group: 'ICT & SMC', label: 'Fair value gap (FVG)', desc: 'A gap left by a fast move that price often comes back to fill.' },
  { key: 'ob', group: 'ICT & SMC', label: 'Order block', desc: 'The last opposite candle before a strong move.' },
  { key: 'bos', group: 'ICT & SMC', label: 'Break of structure / CHoCH', desc: 'Price breaks a recent high or low, showing the trend may be changing.' },
  { key: 'liq', group: 'ICT & SMC', label: 'Liquidity sweep', desc: 'Price spikes past an old high or low, then turns back.' },
  { key: 'ote', group: 'ICT & SMC', label: 'Optimal trade entry (OTE)', desc: 'A pullback into the 62–79% Fibonacci zone.' },
  { key: 'ema', group: 'Classic indicators', label: 'EMA trend (20 / 50)', desc: 'The fast average crosses the slow one.' },
  { key: 'rsi', group: 'Classic indicators', label: 'RSI overbought / oversold', desc: 'RSI above 70 or below 30.' },
  { key: 'brk', group: 'Classic indicators', label: 'Breakout', desc: 'Price breaks its 20-bar high or low.' },
  { key: 'macd', group: 'Classic indicators', label: 'MACD cross', desc: 'The MACD line crosses its signal line.' },
  { key: 'ibb', group: 'Price action', label: 'Inside bar breakout', desc: 'Price breaks out of an inside-bar pattern.' },
  { key: 'london', group: 'ICT & SMC', label: 'London breakout', desc: 'Break of the Asian range in the London morning (intraday charts).' },
  { key: 'pullback', group: 'Classic indicators', label: 'Trend pullback (200 / 20 EMA)', desc: 'With the 200 EMA trend, price pulls back to the 20 EMA.' },
  { key: 'bb', group: 'Classic indicators', label: 'Bollinger Band bounce', desc: 'Price closes back inside the bands.' },
  { key: 'stoch', group: 'Classic indicators', label: 'Stochastic cross', desc: 'Crosses up from oversold or down from overbought.' },
  { key: 'supertrend', group: 'Classic indicators', label: 'Supertrend flip', desc: 'Supertrend (10, 3) changes direction.' },
];
