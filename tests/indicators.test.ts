import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '../src/lib/trading/indicators';
import { INDICATOR_EXAMPLES, computePreview, parseIndicator, sanitizeIndicator, toMql5Indicator, toPineIndicator } from '../src/lib/trading/indicatorspec';
import { toPine } from '../src/lib/trading/botspec';
import { sanitizeRules } from '../src/lib/trading/botspec';

function market(n: number, seed = 3): Candle[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: Candle[] = [];
  let p = 1.1;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + (r() - 0.5) * 0.004 + (i % 60 < 30 ? 0.0004 : -0.0004);
    out.push({ t: Date.UTC(2026, 0, 1) + i * 3600000, o, c, h: Math.max(o, c) + r() * 0.0015, l: Math.min(o, c) - r() * 0.0015 });
    p = c;
  }
  return out;
}

test('reads plain-words indicator descriptions', () => {
  const a = parseIndicator(INDICATOR_EXAMPLES[0]);
  assert.ok(a.confident);
  assert.deepEqual(a.spec.lines.filter((l) => l.type === 'ema').map((l) => l.length).sort((x, y) => x - y), [20, 50, 200]);
  assert.equal(a.spec.signals?.entry.kind, 'ema_cross');
  assert.equal(a.spec.signals?.trendFilter, 'ema200');

  const b = parseIndicator(INDICATOR_EXAMPLES[1]);
  assert.equal(b.spec.panel.type, 'rsi');
  assert.equal(b.spec.panel.lower, 30);
  assert.equal(b.spec.signals?.entry.kind, 'rsi');

  const c = parseIndicator(INDICATOR_EXAMPLES[2]);
  assert.ok(c.spec.lines.some((l) => l.type === 'bb' && l.length === 20 && l.mult === 2));
  assert.equal(c.spec.panel.type, 'rsi');

  const d = parseIndicator(INDICATOR_EXAMPLES[3]);
  assert.equal(d.spec.signals?.entry.kind, 'fvg');
  assert.equal(d.spec.signals?.confirm?.kind, 'liq');
  assert.equal(d.spec.signals?.session, 'london_ny');

  const e = parseIndicator('just something nice');
  assert.equal(e.confident, false);
  assert.ok(e.questions.length > 0);
});

test('preview computes lines, panel and signals of matching length', () => {
  const c = market(600);
  for (const ex of INDICATOR_EXAMPLES) {
    const pv = computePreview(parseIndicator(ex).spec, c);
    assert.equal(pv.signals.length, c.length);
    for (const l of pv.lines) assert.equal(l.values.length, c.length);
  }
  const pv = computePreview(parseIndicator(INDICATOR_EXAMPLES[0]).spec, c);
  assert.ok(pv.signals.some((s) => s !== 0), 'EMA cross should fire on synthetic data');
});

test('exports Pine v6 indicator and MQL5 indicator', () => {
  for (const ex of INDICATOR_EXAMPLES) {
    const spec = parseIndicator(ex).spec;
    const pine = toPineIndicator(spec);
    assert.match(pine, /^\/\/@version=6/);
    assert.match(pine, /indicator\(/);
    assert.doesNotMatch(pine, /strategy\./);
    if (spec.signals) assert.match(pine, /finalSig/);
    if (spec.panel.type !== 'none') assert.match(pine, /force_overlay = true/);
    const mq = toMql5Indicator(spec);
    assert.match(mq, /indicator_chart_window/);
    assert.match(mq, /OnCalculate/);
    const bufs = Number(mq.match(/indicator_buffers (\d+)/)![1]);
    assert.equal((mq.match(/SetIndexBuffer\(/g) || []).length, bufs);
  }
  const onlyPanel = sanitizeIndicator({ lines: [], panel: { type: 'rsi', length: 14, lower: 30, upper: 70 }, signals: null });
  assert.match(toMql5Indicator(onlyPanel), /built-in RSI/);
});

test('bot strategy Pine still builds after sharing the core', () => {
  const pine = toPine(sanitizeRules({ entry: { kind: 'fvg' }, confirm: { kind: 'liq', within: 10 } }));
  assert.match(pine, /strategy\(/);
  assert.match(pine, /strategy\.entry\("Buy"/);
  assert.match(pine, /finalSig = /);
});

test('market structure summary uses only real prices', async () => {
  const { analyzeStructure } = await import('../src/lib/trading/structure');
  const c = market(600);
  const s = analyzeStructure(c, 5)!;
  assert.ok(s);
  assert.ok(['up', 'down', 'sideways'].includes(s.trend.bias));
  for (const p of s.resistance) assert.ok(p > s.lastClose);
  for (const p of s.support) assert.ok(p < s.lastClose);
  const prices = new Set(c.flatMap((x) => [x.h, x.l].map((v) => Number(v.toFixed(5)))));
  for (const p of [...s.resistance, ...s.support]) assert.ok(prices.has(p), 'levels come from real candle highs/lows');
  assert.equal(analyzeStructure(c.slice(0, 50), 5), null);
});

test('break-even and trailing stops in the backtest, plus out-of-sample split', async () => {
  const { backtest } = await import('../src/lib/trading/backtest');
  const { parseStrategy } = await import('../src/lib/trading/botspec');
  const pip = 0.0001;
  const mk = (closes: number[]) => closes.map((c, i) => ({ t: Date.UTC(2026, 0, 5) + i * 3600000, o: i ? closes[i - 1] : c, c, h: Math.max(c, i ? closes[i - 1] : c) + 0.00002, l: Math.min(c, i ? closes[i - 1] : c) - 0.00002 }));
  // flat, breakout up (signal), run up 30 pips, then fall 60 pips
  const closes = [...Array(40).fill(1.1), 1.1005, 1.1010, 1.1020, 1.1035, 1.1030, 1.1015, 1.1000, 1.0985, 1.0975, ...Array(20).fill(1.0975)];
  const c = mk(closes);
  const base = sanitizeRules({ entry: { kind: 'breakout', lookback: 20 }, direction: 'long', stopLossPips: 20, takeProfitPips: 100, maxTradesPerDay: 1, session: 'any' });
  const plain = backtest(base, c, pip, 0);
  assert.equal(plain.log[0].result, 'Loss');
  assert.equal(plain.log[0].pips, -20);
  const be = backtest({ ...base, breakEvenPips: 15 }, c, pip, 0);
  assert.equal(be.log[0].result, 'Win');
  assert.equal(be.log[0].pips, 1);
  const tr = backtest({ ...base, trailPips: 10 }, c, pip, 0);
  assert.equal(tr.log[0].result, 'Win');
  assert.ok(tr.log[0].pips > 1 && tr.log[0].pips < 30);

  const p = parseStrategy('Buy EURUSD on the 1 hour when the 20 EMA crosses above the 50 EMA. Stop loss 20 pips, take profit 60 pips. Move stop to break even after 15 pips and use a trailing stop of 25 pips.');
  assert.equal(p.rules.breakEvenPips, 15);
  assert.equal(p.rules.trailPips, 25);
  const mq = (await import('../src/lib/trading/codegen-mql5')).toMql5(p.rules);
  assert.match(mq, /BreakEvenPips = 15/);
  assert.match(mq, /ManagePosition\(\);/);
  assert.match(toPine(p.rules), /trP = input\.float\(25/);

  const long = backtest(sanitizeRules({ entry: { kind: 'ema_cross', fast: 5, slow: 20 }, stopLossPips: 20, takeProfitPips: 40, maxTradesPerDay: 50 }), market(1500), pip, 1);
  assert.ok(long.split);
  assert.equal(long.split!.inSample.trades + long.split!.outOfSample.trades, long.log.length);
});

test('chart review falls back to real-data analysis', async () => {
  const { analyzeStructure } = await import('../src/lib/trading/structure');
  const { fromData } = await import('../src/lib/trading/chartreview');
  const st = analyzeStructure(market(600), 5)!;
  const a = fromData(st, [{ name: 'CPI', country: 'US', scheduled_at: '2026-10-15T12:30:00Z', impact: 'high' }], [{ bank: 'Federal Reserve', rate: 3.75, next_meeting: '2026-10-28' }]);
  assert.equal(a.scenarios.length, 2);
  assert.ok(a.fundamentals.some((f) => f.includes('CPI')));
  assert.ok(a.leaning.length > 10);
});
