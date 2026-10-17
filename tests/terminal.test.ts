import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '../src/lib/trading/indicators';
import { NEEDED, pressure } from '../src/lib/terminal/pressure';
import { candleFacts } from '../src/lib/terminal/why';
import type { ChartData } from '../src/lib/terminal/data';

const H = 3600000;
function walk(n: number, seed: number, start: number, offset = 0, drift: (i: number) => number = () => 0): Candle[] {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let p = start;
  return Array.from({ length: n }, (_, i) => {
    const o = p;
    const c = o * (1 + (r() - 0.5) * 0.004 + drift(i));
    p = c;
    return { t: 1_760_000_000_000 - (1_760_000_000_000 % H) + i * H + offset, o, h: Math.max(o, c) * 1.0005, l: Math.min(o, c) * 0.9995, c };
  });
}

function world(usdShock: number) {
  // the dollar jumps on candle 150: EUR, GBP, AUD fall, JPY, CAD, CHF pairs rise
  const shock = (sign: number) => (i: number) => (i === 150 ? sign * usdShock : 0);
  const all: Record<string, Candle[]> = {};
  NEEDED.forEach((k, j) => { all[k] = walk(200, 11 + j * 7, 100); });
  all.EURUSD = walk(200, 3, 1.1, 0, shock(-1));
  all.GBPUSD = walk(200, 5, 1.3, 0, shock(-1));
  all.AUDUSD = walk(200, 9, 0.66, 0, shock(-1));
  all.USDJPY = walk(200, 13, 150, 0, shock(1));
  all.USDCAD = walk(200, 17, 1.37, 0, shock(1));
  all.USDCHF = walk(200, 19, 0.8, 0, shock(1));
  all.SPY = walk(200, 23, 600, 30 * 60000); // US stocks stamp candles at :30
  return all;
}

test('a dollar jump shows as strong pressure down on gold, and the dollar leads the parts', () => {
  const all = world(0.006);
  const pts = pressure('XAUUSD', all.XAUUSD, all);
  assert.equal(pts.length, 200);
  assert.equal(pts[5].score, null, 'no score until there is enough history');
  const p = pts[150];
  assert.ok(p.score != null && p.score <= -60, `expected strong push down, got ${p.score}`);
  const top = [...p.parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  assert.equal(top.label, 'US dollar');
  assert.ok(top.value < 0);
  for (const x of pts) if (x.score != null) assert.ok(x.score >= -100 && x.score <= 100);
});

test('EUR/USD reads the dollar without its own leg, and stocks at :30 still line up', () => {
  const all = world(0.006);
  const eur = pressure('EURUSD', all.EURUSD, all)[150];
  assert.ok(eur.score != null && eur.score < -40);
  const spy = pressure('SPY', all.SPY, all);
  assert.ok(spy.filter((x) => x.score != null).length > 50, 'S&P 500 gets scores even though its candles are stamped at :30');
});

test('unknown market gives no scores', () => {
  const all = world(0);
  assert.ok(pressure('NOPE', all.XAUUSD, all).every((x) => x.score == null));
});

test('candle facts are built only from the data given', () => {
  const all = world(0.006);
  const pts = pressure('XAUUSD', all.XAUUSD, all);
  const d: ChartData = {
    market: 'XAUUSD', label: 'Gold', tf: '1h', digits: 2, pricingIn: [], updated: '',
    candles: all.XAUUSD.map((c, i) => ({ ...c, ...pts[i] })),
    events: [{ i: 150, t: all.XAUUSD[150].t, kind: 'data', theme: 'data', icon: '📊', head: 'US CPI m/m', detail: '0.5% vs 0.3% expected', dir: 'down', move: -0.4, count: 1 }],
  };
  const f = candleFacts(d, 150);
  assert.match(f.facts[0], /^Gold moved [+-]\d+\.\d\d% in this hour/);
  assert.ok(f.facts.some((x) => /US dollar/.test(x)));
  assert.equal(f.events[0].head, 'US CPI m/m');
  assert.equal(f.events[0].when, 'this hour');
  const quiet = candleFacts({ ...d, events: [] }, 60);
  assert.ok(quiet.facts.some((x) => /No big economic release/.test(x)));
});

import { BUCKETS, bucketOf, buildPlaybook, historyLabel, ranges, typicalStep } from '../src/lib/terminal/playbook';

test('playbook ranges follow the published precision', () => {
  const r = ranges(0.3, 0.1, 1, '%');
  assert.equal(r.inline, '0.3%');
  assert.equal(r.higher, '0.4%');
  assert.equal(r.much_higher, '0.5% or more');
  assert.equal(r.lower, '0.2%');
  assert.equal(r.much_lower, '0.1% or less');
  const k = ranges(220, 30, 0, 'K');
  assert.equal(k.inline, '206K to 234K');
  assert.equal(k.higher, '235K to 264K');
  assert.equal(k.much_higher, '265K or more');
  assert.equal(k.much_lower, '175K or less');
  // every number between much lower and much higher lands in the bucket its range says
  for (let a = 170; a <= 270; a++) {
    const b = bucketOf(a, 220, 30);
    const want = a >= 265 ? 'much_higher' : a >= 235 ? 'higher' : a > 205 ? 'inline' : a > 175 ? 'lower' : 'much_lower';
    assert.equal(b, want, `actual ${a}`);
  }
});

test('typical step is the median surprise, rounded to the published precision', () => {
  assert.equal(typicalStep([0.1, -0.2, 0.1, 0.2, 0, 0.3], '0.3%'), 0.2);
  assert.equal(typicalStep([0.1], '0.3%'), 0.1, 'too little history: one unit');
  assert.equal(typicalStep([], '225K'), 11);
});

test('playbook groups past releases and lights the bucket of the actual', () => {
  const row = (d: string, actual: string, forecast: string, asset: string, m: string) => ({ asset, released_at: d, actual, forecast, move_15m: m, move_1h: null });
  const rows = [
    row('2024-01-11', '0.4%', '0.2%', 'EURUSD', '-0.30% (-33 pips)'), row('2024-01-11', '0.4%', '0.2%', 'XAUUSD', '-0.50%'),
    row('2024-02-13', '0.4%', '0.3%', 'EURUSD', '-0.20% (-22 pips)'), row('2024-02-13', '0.4%', '0.3%', 'XAUUSD', '-0.40%'),
    row('2024-03-12', '0.4%', '0.3%', 'EURUSD', '-0.10% (-11 pips)'), row('2024-03-12', '0.4%', '0.3%', 'XAUUSD', '+0.10%'),
    row('2024-04-10', '0.2%', '0.3%', 'EURUSD', '+0.25% (+27 pips)'), row('2024-04-10', '0.2%', '0.3%', 'XAUUSD', '+0.60%'),
    row('2024-05-15', '0.2%', '0.3%', 'EURUSD', '+0.15%'),
    row('2024-06-12', '0.3%', '0.3%', 'EURUSD', '+0.01%'),
  ];
  const p = buildPlaybook('US CPI m/m', '0.3%', rows, '0.4%');
  assert.equal(p.cases, 6);
  assert.equal(p.step, 0.1);
  assert.equal(p.lit, 'higher');
  const higher = p.steps.find((s) => s.key === 'higher')!;
  const eur = higher.markets.find((m) => m.asset === 'EURUSD')!;
  assert.deepEqual([eur.cases, eur.up, eur.down], [2, 0, 2]);
  assert.equal(eur.horizon, '15 min');
  assert.equal(p.steps.map((s) => s.key).join(), BUCKETS.map((b) => b.key).join());
  assert.equal(buildPlaybook('X', null, rows).steps.length, 0, 'no forecast, no ladder');
});

test('calendar names map to the bot history labels', () => {
  assert.equal(historyLabel('US', 'Core CPI m/m'), 'US Core CPI m/m');
  assert.equal(historyLabel('US', 'CPI m/m'), 'US CPI m/m');
  assert.equal(historyLabel('US', 'Non-Farm Employment Change'), 'US Non-Farm Payrolls');
  assert.equal(historyLabel('US', 'Advance GDP q/q'), 'US GDP q/q');
  assert.equal(historyLabel('UK', 'CPI y/y'), null);
});
