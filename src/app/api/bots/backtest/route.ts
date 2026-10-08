import { safeError } from '@/lib/http';
import { hasDb } from '@/lib/db';
import { body, fail, json } from '@/lib/http';
import { sanitizeRules } from '@/lib/trading/botspec';
import { backtest } from '@/lib/trading/backtest';
import { getBacktestCandles } from '@/lib/trading/prices';
import { findSymbol, type TF } from '@/lib/trading/symbols';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasDb()) return fail('Backtesting is not connected yet.', 503);
  if (!process.env.TWELVE_DATA_API_KEY) return fail('Backtesting is being set up. Please check back soon.', 503);
  const b = await body(req);
  const rules = sanitizeRules(b.rules as never);
  const sym = findSymbol(rules.symbol);
  if (!sym) return fail(`We do not have price history for ${rules.symbol} yet. Try EURUSD, GBPUSD, USDJPY, XAUUSD or BTCUSD.`);
  const tf = ({ M1: '1min', M5: '5min', M15: '15min', M30: '30min', H1: '1h', H4: '4h', D1: '1day', W1: '1week', MN1: '1month' } as Record<string, TF>)[rules.timeframe];
  try {
    const candles = await getBacktestCandles(sym, tf);
    if (candles.length < 200) return fail('Not enough price history to test this market.');
    const spread = sym.group === 'Forex' ? (sym.key.includes('JPY') || sym.key === 'GBPJPY' ? 1.5 : 1) : sym.group === 'Crypto' ? 2 : 3;
    return json({ ok: true, symbol: sym.label, timeframe: rules.timeframe, result: backtest(rules, candles, sym.pip, spread) });
  } catch (e) {
    console.error('backtest', safeError(e));
    return fail(/credits|limit/i.test((e as Error).message) ? 'Our price data limit is busy. Please try again in a minute.' : 'The backtest could not run right now. Please try again.', 502);
  }
}
