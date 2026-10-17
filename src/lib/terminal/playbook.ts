import { db } from '../db';

/**
 * Release playbook (Pro FX calendar): for an upcoming release, five outcomes from "much higher" to
 * "much lower" than expected, the number that would put the result in each, and what the markets did
 * the last times the result landed there. Every figure comes from past official releases and the
 * measured price moves stored in mi_reactions; nothing is guessed.
 */

export type Step = { key: Bucket; label: string; range: string; markets: { asset: string; cases: number; up: number; down: number; avg: number; horizon: string }[] };
export type Bucket = 'much_higher' | 'higher' | 'inline' | 'lower' | 'much_lower';
export type Playbook = { label: string | null; forecast: string | null; step: number | null; unit: string; steps: Step[]; cases: number; lit: Bucket | null; actual: string | null; since: string | null };

// ForexFactory names -> the labels the bot uses for US history
const US_LABELS: [RegExp, string][] = [
  [/^core cpi m\/m/i, 'US Core CPI m/m'], [/^core cpi y\/y/i, 'US Core CPI y/y'], [/^cpi m\/m/i, 'US CPI m/m'], [/^cpi y\/y/i, 'US CPI y/y'],
  [/non-?farm/i, 'US Non-Farm Payrolls'], [/^unemployment rate/i, 'US Unemployment Rate'], [/^unemployment claims/i, 'US Unemployment Claims'],
  [/^core retail sales/i, 'US Core Retail Sales m/m'], [/^retail sales/i, 'US Retail Sales m/m'], [/gdp q\/q/i, 'US GDP q/q'],
  [/^core pce price index m\/m/i, 'US Core PCE m/m'], [/^pce price index y\/y/i, 'US PCE y/y'], [/^core ppi m\/m/i, 'US Core PPI m/m'], [/^ppi m\/m/i, 'US PPI m/m'],
  [/^federal funds rate/i, 'Fed rate decision'], [/average hourly earnings m\/m/i, 'US Average Hourly Earnings m/m'],
];

export function historyLabel(country: string, name: string): string | null {
  if (country !== 'US') return null;
  for (const [re, label] of US_LABELS) if (re.test(name.trim())) return label;
  return null;
}

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'much_higher', label: 'Much higher than expected' },
  { key: 'higher', label: 'Higher than expected' },
  { key: 'inline', label: 'As expected' },
  { key: 'lower', label: 'Lower than expected' },
  { key: 'much_lower', label: 'Much lower than expected' },
];

export function unitOf(v: string | null): string {
  const m = String(v || '').trim().match(/[%KMBT]$/i);
  return m ? m[0].toUpperCase() : '';
}

function decimals(v: string | null) {
  const m = String(v || '').match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

/** Plain number from text like "0.3%", "225K", "4.50%". K/M/B are kept in their own unit (225K -> 225). */
export function num(v: unknown): number | null {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function bucketOf(actual: number, forecast: number, step: number): Bucket {
  const d = actual - forecast;
  if (Math.abs(d) < step * 0.5 - 1e-9) return 'inline';
  if (d > 0) return d >= step * 1.5 - 1e-9 ? 'much_higher' : 'higher';
  return -d >= step * 1.5 - 1e-9 ? 'much_lower' : 'lower';
}

/** The typical size of a surprise: median of past |actual − forecast|, else one unit of the last decimal. */
export function typicalStep(surprises: number[], forecast: string | null): number {
  const nz = surprises.map(Math.abs).filter((x) => x > 1e-9).sort((a, b) => a - b);
  const d = decimals(forecast);
  const unitStep = d ? 10 ** -d : Math.max(1, Math.round(Math.abs(num(forecast) || 10) * 0.05));
  if (nz.length < 4) return unitStep;
  const med = nz[Math.floor(nz.length / 2)];
  // round to the precision the number is published in, never below one unit
  return Math.max(unitStep, Math.round(med / unitStep) * unitStep);
}

const fmt = (v: number, d: number, unit: string) => `${v.toFixed(d)}${unit}`;

export function ranges(forecast: number, step: number, d: number, unit: string): Record<Bucket, string> {
  const g = 10 ** -d; // the smallest change the number is published in
  const at = (k: number) => fmt(forecast + k * g, d, unit);
  const one = (lo: number, hi: number) => (lo === hi ? at(lo) : `${at(lo)} to ${at(hi)}`);
  const kh = Math.ceil((step * 0.5) / g - 1e-6); // first grid step counted as "higher"
  const kH = Math.ceil((step * 1.5) / g - 1e-6); // first grid step counted as "much higher"
  return {
    much_higher: `${at(kH)} or more`,
    higher: one(kh, Math.max(kh, kH - 1)),
    inline: one(-(kh - 1), kh - 1),
    lower: one(-Math.max(kh, kH - 1), -kh),
    much_lower: `${at(-kH)} or less`,
  };
}

const moveOf = (v: unknown) => { const m = String(v ?? '').match(/^([+-]?\d+(?:\.\d+)?)%/); return m ? parseFloat(m[1]) : null; };

type Row = { asset: string; released_at: string; actual: string | null; forecast: string | null; move_15m: string | null; move_1h: string | null };

/** Pure: build the playbook from history rows (tested). */
export function buildPlaybook(label: string | null, forecastText: string | null, rows: Row[], actualText: string | null = null): Playbook {
  const f = num(forecastText);
  const unit = unitOf(forecastText);
  const usable = rows.filter((r) => num(r.actual) != null && num(r.forecast) != null);
  // one surprise per release (several assets share it)
  const perRelease = new Map<string, number>();
  for (const r of usable) perRelease.set(r.released_at, (num(r.actual) as number) - (num(r.forecast) as number));
  const since = usable.length ? usable.map((r) => r.released_at).sort()[0].slice(0, 4) : null;
  if (f == null) return { label, forecast: forecastText, step: null, unit, steps: [], cases: perRelease.size, lit: null, actual: actualText, since };
  const step = typicalStep([...perRelease.values()], forecastText);
  const d = Math.max(decimals(forecastText), decimals(String(step)));
  const rg = ranges(f, step, d, unit);
  const byBucket = new Map<Bucket, Row[]>();
  for (const r of usable) {
    const b = bucketOf(num(r.actual) as number, num(r.forecast) as number, step);
    byBucket.set(b, [...(byBucket.get(b) || []), r]);
  }
  const steps: Step[] = BUCKETS.map(({ key, label: l }) => {
    const rs = byBucket.get(key) || [];
    const assets = [...new Set(rs.map((r) => r.asset))];
    const markets = assets.map((asset) => {
      const mine = rs.filter((r) => r.asset === asset);
      const n15 = mine.filter((r) => moveOf(r.move_15m) != null).length, n1h = mine.filter((r) => moveOf(r.move_1h) != null).length;
      const use15 = n15 >= Math.min(3, n1h) && n15 > 0;
      const vals = mine.map((r) => moveOf(use15 ? r.move_15m : r.move_1h)).filter((v): v is number => v != null);
      return { asset, cases: vals.length, up: vals.filter((v) => v > 0).length, down: vals.filter((v) => v < 0).length, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0, horizon: use15 ? '15 min' : '1 hour' };
    }).filter((m) => m.cases >= 2).sort((a, b) => PRIORITY.indexOf(a.asset) - PRIORITY.indexOf(b.asset)).slice(0, 4);
    return { key, label: l, range: rg[key], markets };
  });
  const a = num(actualText);
  return { label, forecast: forecastText, step, unit, steps, cases: perRelease.size, lit: a != null ? bucketOf(a, f, step) : null, actual: actualText, since };
}

const PRIORITY = ['EURUSD', 'XAUUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'SPY', 'BTCUSD'].flatMap((x) => [x, x.slice(0, 3) + '/' + x.slice(3)]);

export async function playbookFor(eventId: string): Promise<(Playbook & { event: Record<string, unknown> }) | null> {
  const q = await db();
  const ev = ((await q`SELECT id, country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE id = ${eventId}`) as Record<string, unknown>[])[0];
  if (!ev) return null;
  const label = historyLabel(String(ev.country), String(ev.name));
  const res = ((await q`SELECT actual FROM mi_results WHERE event_id = ${eventId}
      OR (country = ${ev.country} AND lower(name) = lower(${ev.name}) AND released_at BETWEEN ${ev.scheduled_at}::timestamptz - interval '30 minutes' AND ${ev.scheduled_at}::timestamptz + interval '3 hours')
      LIMIT 1`) as { actual: string }[])[0];
  const rows = label
    ? ((await q`SELECT asset, to_char(released_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS released_at, actual, forecast, move_15m, move_1h
        FROM mi_reactions WHERE event_name = ${label} AND released_at < ${ev.scheduled_at} ORDER BY released_at DESC LIMIT 600`) as Row[])
    : ((await q`SELECT asset, to_char(released_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS released_at, actual, forecast, move_15m, move_1h
        FROM mi_reactions WHERE event_name ILIKE ${'%' + String(ev.name) + '%'} AND (country = ${ev.country} OR country IS NULL) AND released_at < ${ev.scheduled_at} ORDER BY released_at DESC LIMIT 600`) as Row[]);
  return { ...buildPlaybook(label || String(ev.name), (ev.forecast as string) || null, rows, res?.actual || null), event: ev };
}
