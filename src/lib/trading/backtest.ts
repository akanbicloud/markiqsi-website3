import type { Candle } from './indicators';
import { signalSeries, type Rules } from './botspec';

export type BacktestResult = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPips: number;
  profitFactor: number | null;
  maxDrawdownPct: number;
  startEquity: number;
  endEquity: number;
  returnPct: number;
  from: string;
  to: string;
  candles: number;
  equity: number[];
  lastTrades: { time: string; side: 'Buy' | 'Sell'; result: 'Win' | 'Loss' | 'Open'; pips: number }[];
  assumptions: string[];
  /** Every closed trade, in order, for the replay and the report card. */
  log: TradeLog[];
  stats: {
    avgWinMoney: number;
    avgLossMoney: number;
    bestTrade: TradeLog | null;
    worstTrade: TradeLog | null;
    longestWinStreak: number;
    longestLossStreak: number;
    drawdownFrom: string;
    drawdownTo: string;
    months: { month: string; pct: number; trades: number }[];
  };
};

export type TradeLog = {
  side: 'Buy' | 'Sell';
  entryIdx: number;
  exitIdx: number;
  entry: number;
  sl: number;
  tp: number;
  result: 'Win' | 'Loss';
  pips: number;
  money: number;
  equityAfter: number;
  openTime: string;
  closeTime: string;
};

/**
 * Simple, honest backtest: signal on a closed candle, enter at the next candle's open,
 * fixed stop loss / take profit in pips, one trade at a time, spread cost on every trade.
 * If stop and target are both inside one candle we assume the STOP was hit first.
 */
export function backtest(r: Rules, c: Candle[], pip: number, spreadPips = 1): BacktestResult {
  const sig = signalSeries(r, c);
  const start = 10000;
  let equity = start;
  let peak = start;
  let maxDd = 0;
  let wins = 0;
  let losses = 0;
  let grossWinPips = 0;
  let grossLossPips = 0;
  const curve: number[] = [start];
  const trades: BacktestResult['lastTrades'] = [];
  const log: TradeLog[] = [];
  let peakIdx = 0;
  let ddFrom = '';
  let ddTo = '';
  const perDay = new Map<string, number>();
  let dayKey = '';
  let dayStartEq = start;

  let i = 1;
  while (i < c.length - 1) {
    const d = new Date(c[i].t).toISOString().slice(0, 10);
    if (d !== dayKey) { dayKey = d; dayStartEq = equity; }
    const s = sig[i];
    const dayCount = perDay.get(d) || 0;
    const dailyStop = equity <= dayStartEq * (1 - r.dailyLossPercent / 100);
    if (s === 0 || dayCount >= r.maxTradesPerDay || dailyStop) { i++; continue; }
    perDay.set(d, dayCount + 1);
    const side = s === 1 ? 'Buy' : 'Sell';
    const entryBar = i + 1;
    const spread = spreadPips * pip;
    const entry = c[entryBar].o + (s === 1 ? spread : -spread);
    const sl = s === 1 ? entry - r.stopLossPips * pip : entry + r.stopLossPips * pip;
    const tp = s === 1 ? entry + r.takeProfitPips * pip : entry - r.takeProfitPips * pip;
    let exitIdx = -1;
    let result: 'Win' | 'Loss' | 'Open' = 'Open';
    for (let j = entryBar; j < c.length; j++) {
      const hitSl = s === 1 ? c[j].l <= sl : c[j].h >= sl;
      const hitTp = s === 1 ? c[j].h >= tp : c[j].l <= tp;
      if (hitSl) { result = 'Loss'; exitIdx = j; break; }
      if (hitTp) { result = 'Win'; exitIdx = j; break; }
    }
    if (result === 'Open') {
      trades.push({ time: new Date(c[entryBar].t).toISOString(), side, result, pips: 0 });
      break;
    }
    const riskMoney = equity * (r.riskPercent / 100);
    const pips = result === 'Win' ? r.takeProfitPips : -r.stopLossPips;
    // spread is already inside the entry price, so the R multiple is exact
    const money = result === 'Win' ? riskMoney * (r.takeProfitPips / r.stopLossPips) : -riskMoney;
    equity += money;
    if (result === 'Win') { wins++; grossWinPips += r.takeProfitPips; } else { losses++; grossLossPips += r.stopLossPips; }
    if (equity > peak) { peak = equity; peakIdx = exitIdx; }
    const dd = (peak - equity) / peak;
    if (dd > maxDd) { maxDd = dd; ddFrom = new Date(c[peakIdx].t).toISOString(); ddTo = new Date(c[exitIdx].t).toISOString(); }
    log.push({ side, entryIdx: entryBar, exitIdx, entry, sl, tp, result, pips, money: Math.round(money * 100) / 100, equityAfter: Math.round(equity * 100) / 100,
      openTime: new Date(c[entryBar].t).toISOString(), closeTime: new Date(c[exitIdx].t).toISOString() });
    curve.push(Math.round(equity * 100) / 100);
    trades.push({ time: new Date(c[entryBar].t).toISOString(), side, result, pips });
    i = exitIdx + 1;
  }
  const n = wins + losses;

  // ---- extra stats for the report card (all from the trades above, nothing estimated)
  let ws = 0, ls = 0, bestW = 0, bestL = 0;
  for (const t of log) {
    if (t.result === 'Win') { ws++; ls = 0; } else { ls++; ws = 0; }
    bestW = Math.max(bestW, ws);
    bestL = Math.max(bestL, ls);
  }
  const winsL = log.filter((t) => t.result === 'Win');
  const lossL = log.filter((t) => t.result === 'Loss');
  const avg = (a: TradeLog[]) => (a.length ? Math.round((a.reduce((x, t) => x + t.money, 0) / a.length) * 100) / 100 : 0);
  const months: { month: string; pct: number; trades: number }[] = [];
  if (c.length) {
    const first = new Date(c[0].t);
    const last = new Date(c[c.length - 1].t);
    let eqStart = start;
    let k = 0;
    for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      let eqEnd = eqStart;
      let cnt = 0;
      while (k < log.length && log[k].closeTime.slice(0, 7) === key) { eqEnd = log[k].equityAfter; cnt++; k++; }
      months.push({ month: key, pct: Math.round(((eqEnd - eqStart) / eqStart) * 1000) / 10, trades: cnt });
      eqStart = eqEnd;
    }
  }
  const byMoney = [...log].sort((a, b) => b.money - a.money || a.exitIdx - b.exitIdx);

  const step = Math.max(1, Math.ceil(curve.length / 80));
  return {
    trades: n,
    wins,
    losses,
    winRate: n ? Math.round((wins / n) * 1000) / 10 : 0,
    netPips: Math.round((grossWinPips - grossLossPips) * 10) / 10,
    profitFactor: grossLossPips > 0 ? Math.round((grossWinPips / grossLossPips) * 100) / 100 : null,
    maxDrawdownPct: Math.round(maxDd * 1000) / 10,
    startEquity: start,
    endEquity: Math.round(equity * 100) / 100,
    returnPct: Math.round(((equity - start) / start) * 1000) / 10,
    from: c.length ? new Date(c[0].t).toISOString() : '',
    to: c.length ? new Date(c[c.length - 1].t).toISOString() : '',
    candles: c.length,
    equity: curve.filter((_, k) => k % step === 0 || k === curve.length - 1),
    lastTrades: trades.slice(-12).reverse(),
    assumptions: [
      `Starting balance $${start.toLocaleString('en-US')}, risking ${r.riskPercent}% per trade.`,
      `${spreadPips} pip spread cost on every trade.`,
      'Entry at the open of the candle after the signal.',
      'If the stop and target are hit in the same candle, we count it as a loss.',
      'No slippage, swaps or commissions beyond the spread.',
    ],
    log,
    stats: {
      avgWinMoney: avg(winsL),
      avgLossMoney: avg(lossL),
      bestTrade: byMoney[0] && byMoney[0].money > 0 ? byMoney[0] : null,
      worstTrade: byMoney.length && byMoney[byMoney.length - 1].money < 0 ? byMoney[byMoney.length - 1] : null,
      longestWinStreak: bestW,
      longestLossStreak: bestL,
      drawdownFrom: ddFrom,
      drawdownTo: ddTo,
      months,
    },
  };
}
