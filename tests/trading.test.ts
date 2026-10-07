import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '../src/lib/trading/indicators';
import { ema, rsi, swings } from '../src/lib/trading/indicators';
import { DETECTORS, makeCtx, runAll } from '../src/lib/trading/detect';
import { parseStrategy, sanitizeRules, signalSeries, toMql5, toPine } from '../src/lib/trading/botspec';
import { backtest } from '../src/lib/trading/backtest';

const H = 3600000;
function series(closes: number[], wick = 0.0005): Candle[] {
  return closes.map((c, i) => {
    const o = i ? closes[i - 1] : c;
    return { t: Date.UTC(2026, 0, 1) + i * H, o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick };
  });
}
function market(n: number, seed = 1): Candle[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: Candle[] = [];
  let p = 1.1;
  let drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 40 === 0) drift = (r() - 0.5) * 0.0012;
    const o = p + (r() - 0.5) * 0.0004;
    const shock = r() < 0.04 ? (r() - 0.5) * 0.012 : 0;
    const c = o + drift + (r() - 0.5) * 0.003 + shock;
    out.push({ t: Date.UTC(2026, 0, 1) + i * H, o, c, h: Math.max(o, c) + r() * 0.0015, l: Math.min(o, c) - r() * 0.0015 });
    p = c;
  }
  return out;
}
function noise(n: number, seed = 1, start = 1.1, step = 0.0012) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < n; i++) { p += (r() - 0.5) * step; out.push(p); }
  return out;
}

test('ema and rsi basics', () => {
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.equal(e[2], 2);
  assert.ok(Math.abs(e[4] - 4) < 1e-9);
  const up = rsi(Array.from({ length: 30 }, (_, i) => i), 14);
  assert.equal(up[29], 100);
});

test('swings finds a clear peak', () => {
  const c = series([1, 2, 3, 5, 3, 2, 1, 2, 3]);
  const s = swings(c, 2);
  assert.ok(s.some((x) => x.type === 'H' && x.i === 3));
});

test('every detector runs without throwing on random data', () => {
  for (let seed = 1; seed < 40; seed++) {
    const c = market(300, seed);
    const ctx = makeCtx(c, 5)!;
    for (const [k, d] of Object.entries(DETECTORS)) {
      const r = d(ctx);
      if (r) {
        assert.equal(r.strategy, k);
        assert.ok(r.strength >= 1 && r.strength <= 5);
        assert.ok(['Bullish', 'Bearish'].includes(r.direction));
        assert.ok(r.detail.length > 5);
      }
    }
  }
});

test('detectors find something across many random markets', () => {
  const hits: Record<string, number> = {};
  for (let seed = 1; seed < 400; seed++) {
    for (const s of runAll(market(300, seed), 5)) hits[s.strategy] = (hits[s.strategy] || 0) + 1;
  }
  for (const k of ['ema', 'rsi', 'brk', 'macd', 'candles', 'sr', 'fvg', 'bos', 'liq', 'sd', 'ob', 'ote']) assert.ok((hits[k] || 0) > 0, `no ${k} found: ${JSON.stringify(hits)}`);
  // no single detector should fire on most markets (that would make it useless)
  for (const [k, n] of Object.entries(hits)) assert.ok(n < 399 * 0.5, `${k} fires too often: ${n}`);
  console.log('hits per 399 random markets', hits);
});

test('bullish engulfing is detected', () => {
  const base = noise(120, 7);
  const c = series(base, 0.0003);
  const L = c.length - 1;
  const b0 = c[L - 2].c;
  const p = c[L - 1];
  p.o = b0 + 0.0010; p.c = b0; p.h = b0 + 0.0012; p.l = b0 - 0.0002;
  const x = c[L];
  x.o = b0 - 0.0002; x.c = b0 + 0.0030; x.h = b0 + 0.0032; x.l = b0 - 0.0004;
  const ctx = makeCtx(c, 5)!;
  const r = DETECTORS.candles(ctx);
  assert.ok(r && r.direction === 'Bullish', JSON.stringify(r));
});

test('fair value gap is detected when price returns into it', () => {
  const closes = Array.from({ length: 100 }, () => 1.1);
  const c = series(closes, 0.0002);
  // big up move leaving a gap between candle 90 high and candle 92 low
  c[90] = { t: c[90].t, o: 1.1, c: 1.1005, h: 1.1008, l: 1.0995 };
  c[91] = { t: c[91].t, o: 1.1005, c: 1.1060, h: 1.1062, l: 1.1004 };
  c[92] = { t: c[92].t, o: 1.1060, c: 1.1080, h: 1.1085, l: 1.1040 };
  for (let i = 93; i < 99; i++) c[i] = { t: c[i].t, o: 1.108, c: 1.1082, h: 1.109, l: 1.1075 };
  c[99] = { t: c[99].t, o: 1.1075, c: 1.1035, h: 1.1078, l: 1.1030 };
  const r = DETECTORS.fvg(makeCtx(c, 5)!);
  assert.ok(r && r.direction === 'Bullish', JSON.stringify(r));
});

test('parser reads a typical strategy (legacy)', () => {
  const p = parseStrategy('Buy EURUSD when the 20 EMA crosses above the 50 EMA on the 1-hour chart, and sell when it crosses below. Stop loss 20 pips, take profit 40 pips. Risk 1% per trade.');
  assert.equal(p.rules.symbol, 'EURUSD');
  assert.equal(p.rules.timeframe, 'H1');
  assert.equal(p.rules.entry.kind, 'ema_cross');
  assert.equal(p.rules.entry.fast, 20);
  assert.equal(p.rules.entry.slow, 50);
  assert.equal(p.rules.direction, 'both');
  assert.equal(p.rules.stopLossPips, 20);
  assert.equal(p.rules.takeProfitPips, 40);
  assert.equal(p.rules.riskPercent, 1);
  assert.equal(p.questions.length, 0);
});

test('parser reads RSI and gold', () => {
  const p = parseStrategy('On gold 4h chart buy when RSI(14) goes below 30 and sell when RSI is above 70, SL 50 pips TP 100 pips, risk 2%');
  assert.equal(p.rules.symbol, 'XAUUSD');
  assert.equal(p.rules.timeframe, 'H4');
  assert.equal(p.rules.entry.kind, 'rsi');
  assert.equal(p.rules.direction, 'both');
  assert.equal(p.rules.stopLossPips, 50);
  assert.equal(p.rules.riskPercent, 2);
});

test('parser asks when the entry is missing', () => {
  const p = parseStrategy('I like to trade gold when it feels strong');
  assert.equal(p.confident, false);
  assert.ok(p.questions.length > 0);
});

test('code generators produce complete code', () => {
  for (const kind of ['ema_cross', 'sma_cross', 'rsi', 'macd_cross', 'breakout'] as const) {
    const r = sanitizeRules({ entry: { kind } });
    const m = toMql5(r);
    assert.ok(m.includes('int SignalNow()') && m.includes('trade.Buy') && m.includes('OnTick'));
    assert.equal((m.match(/\{/g) || []).length, (m.match(/\}/g) || []).length, 'balanced braces in MQL5 ' + kind);
    const pine = toPine(r);
    assert.ok(pine.startsWith('//@version=6') && pine.includes('strategy.entry') && pine.includes('finalSig'));
  }
});

test('backtest is consistent', () => {
  const c = series(noise(3000, 5, 1.1, 0.002));
  const r = sanitizeRules({ entry: { kind: 'ema_cross', fast: 10, slow: 30 }, stopLossPips: 20, takeProfitPips: 40 });
  const res = backtest(r, c, 0.0001, 1);
  assert.equal(res.wins + res.losses, res.trades);
  assert.ok(res.trades > 10);
  assert.equal(res.netPips, res.wins * 40 - res.losses * 20);
  assert.ok(res.maxDrawdownPct >= 0 && res.maxDrawdownPct <= 100);
  const sig = signalSeries(r, c);
  assert.ok(sig.some((v) => v === 1) && sig.some((v) => v === -1));
});
