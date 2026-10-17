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
