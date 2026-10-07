import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candle } from '../src/lib/trading/indicators';
import { DETECTORS, at, makeCtx } from '../src/lib/trading/detect';
import { ENTRY_GROUPS, PRESETS, DEFAULT_RULES, parseStrategy, sanitizeRules, signalSeries, type EntryKind } from '../src/lib/trading/botspec';
import { toMql5 } from '../src/lib/trading/codegen-mql5';
import { toPine } from '../src/lib/trading/codegen-pine';
import { backtest } from '../src/lib/trading/backtest';

const H = 3600000;
function market(n: number, seed = 1, stepMs = H): Candle[] {
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
    out.push({ t: Date.UTC(2026, 0, 5) + i * stepMs, o, c, h: Math.max(o, c) + r() * 0.0015, l: Math.min(o, c) - r() * 0.0015 });
    p = c;
  }
  return out;
}

test('detectors never look at future candles', () => {
  for (let seed = 1; seed < 25; seed++) {
    const full = market(400, seed, 15 * 60000);
    const ctx = makeCtx(full, 5)!;
    for (let L = 120; L < 400; L += 23) {
      const cut = makeCtx(full.slice(0, L + 1), 5)!;
      for (const [k, d] of Object.entries(DETECTORS)) {
        const a = d(at(ctx, L));
        const b = d(cut);
        assert.equal(a?.direction ?? null, b?.direction ?? null, `${k} differs at ${L} seed ${seed}`);
      }
    }
  }
});

test('new strategies fire sometimes but not always', () => {
  const hits: Record<string, number> = {};
  for (let seed = 1; seed < 300; seed++) {
    const c = market(320, seed, 15 * 60000);
    const ctx = makeCtx(c, 5)!;
    for (const k of ['bb', 'stoch', 'supertrend', 'pullback', 'ibb', 'london']) if (DETECTORS[k](ctx)) hits[k] = (hits[k] || 0) + 1;
  }
  for (const k of ['bb', 'stoch', 'supertrend', 'pullback', 'ibb']) {
    assert.ok((hits[k] || 0) > 0, `${k} never fired ${JSON.stringify(hits)}`);
    assert.ok((hits[k] || 0) < 150, `${k} fires too often ${JSON.stringify(hits)}`);
  }
});

test('london breakout finds a clean break of the Asian range', () => {
  const day = Date.UTC(2026, 2, 3);
  const c: Candle[] = [];
  for (let i = 0; i < 200; i++) {
    const t = day - (199 - i) * H + 7 * H; // ends at 07:00 UTC on `day`
    c.push({ t, o: 1.1, h: 1.1010, l: 1.0990, c: 1.1 });
  }
  const L = c.length - 1;
  assert.equal(new Date(c[L].t).getUTCHours(), 7);
  c[L] = { ...c[L], o: 1.1, h: 1.1040, l: 1.0995, c: 1.1035 };
  const s = DETECTORS.london(makeCtx(c, 5)!);
  assert.equal(s?.direction, 'Bullish');
});

test('every entry kind produces signals, code and a backtest', () => {
  const c = market(2500, 9);
  const kinds = ENTRY_GROUPS.flatMap((g) => g.items.map((i) => i.kind)) as EntryKind[];
  assert.equal(kinds.length, 19);
  for (const kind of kinds) {
    const r = sanitizeRules({ ...DEFAULT_RULES, entry: { kind } });
    const sig = signalSeries(r, c);
    assert.equal(sig.length, c.length);
    const bt = backtest(r, c, 0.0001, 1);
    assert.equal(bt.wins + bt.losses, bt.trades);
    const m = toMql5(r);
    assert.equal((m.match(/\{/g) || []).length, (m.match(/\}/g) || []).length, `braces ${kind}`);
    assert.equal((m.match(/\(/g) || []).length, (m.match(/\)/g) || []).length, `parens ${kind}`);
    assert.ok(m.includes(`input int    EntryKind = `));
    const p = toPine(r);
    assert.ok(p.startsWith('//@version=6'));
    assert.equal((p.match(/\(/g) || []).length, (p.match(/\)/g) || []).length, `pine parens ${kind}`);
    assert.equal((p.match(/\[/g) || []).length, (p.match(/\]/g) || []).length, `pine brackets ${kind}`);
    assert.ok(!/\t/.test(p), 'pine must use spaces');
  }
});

test('confirmation, trend and session filters only remove signals', () => {
  const c = market(2500, 4, 15 * 60000);
  const base = sanitizeRules({ ...DEFAULT_RULES, entry: { kind: 'fvg' } });
  const plain = signalSeries(base, c);
  const filtered = signalSeries(sanitizeRules({ ...base, confirm: { kind: 'liq', within: 10 }, trendFilter: 'ema200', session: 'london_ny' }), c);
  for (let i = 0; i < c.length; i++) if (filtered[i]) assert.equal(filtered[i], plain[i]);
  assert.ok(filtered.filter(Boolean).length <= plain.filter(Boolean).length);
});

test('presets are valid', () => {
  for (const p of PRESETS) {
    const r = sanitizeRules({ ...DEFAULT_RULES, ...p.rules, entry: { ...DEFAULT_RULES.entry, ...(p.rules.entry || {}) } as never });
    assert.ok(r.entry.kind);
  }
});

test('reader understands ICT and SMC wording', () => {
  const a = parseStrategy('Trade EURUSD on the 15-minute chart. After a liquidity sweep, enter on the fair value gap, only during London and New York, and only with the 200 EMA trend. Stop loss 15 pips, take profit 30 pips. Risk 1% per trade.');
  assert.equal(a.rules.entry.kind, 'fvg');
  assert.equal(a.rules.confirm?.kind, 'liq');
  assert.equal(a.rules.session, 'london_ny');
  assert.equal(a.rules.trendFilter, 'ema200');
  assert.equal(a.rules.timeframe, 'M15');
  const b = parseStrategy('Gold 1 hour: when price breaks structure (BOS), buy the order block. SL 30 pips, 1:3, risk 0.5%');
  assert.equal(b.rules.symbol, 'XAUUSD');
  assert.equal(b.rules.entry.kind, 'ob');
  assert.equal(b.rules.confirm?.kind, 'bos');
  assert.equal(b.rules.takeProfitPips, 90);
  const c = parseStrategy('Buy GBPUSD at fresh demand zones on the 4h chart, sell at supply. stop loss 25 pips take profit 75 pips risk 1%');
  assert.equal(c.rules.entry.kind, 'sd');
  assert.equal(c.rules.timeframe, 'H4');
  const d = parseStrategy('London breakout on GBPUSD 15 min, sl 20 pips tp 40 pips risk 1%');
  assert.equal(d.rules.entry.kind, 'london');
});
