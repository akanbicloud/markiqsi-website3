import { db } from '../db';
import { claim, note } from '../marketfeed';

/**
 * CFTC Commitments of Traders (legacy, futures only), published every Friday for positions held on
 * Tuesday. "Speculators" = non-commercial traders (funds). Data: publicreporting.cftc.gov dataset 6dca-aqww.
 * Each market's contract is found by name and the one with the most open interest is used, so a
 * small side contract is never shown by mistake.
 */

const URL_ = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

export const COT_MARKETS: { key: string; label: string; where: string; invert?: boolean }[] = [
  { key: 'EUR', label: 'Euro', where: "market_and_exchange_names like 'EURO FX - %'" },
  { key: 'GBP', label: 'British pound', where: "market_and_exchange_names like 'BRITISH POUND%'" },
  { key: 'JPY', label: 'Japanese yen', where: "market_and_exchange_names like 'JAPANESE YEN%'" },
  { key: 'AUD', label: 'Australian dollar', where: "market_and_exchange_names like 'AUSTRALIAN DOLLAR%'" },
  { key: 'CAD', label: 'Canadian dollar', where: "market_and_exchange_names like 'CANADIAN DOLLAR%'" },
  { key: 'CHF', label: 'Swiss franc', where: "market_and_exchange_names like 'SWISS FRANC%'" },
  { key: 'NZD', label: 'New Zealand dollar', where: "(market_and_exchange_names like 'NZ DOLLAR%' OR market_and_exchange_names like 'NEW ZEALAND DOLLAR%')" },
  { key: 'USD', label: 'US dollar index', where: "(market_and_exchange_names like 'U.S. DOLLAR INDEX%' OR market_and_exchange_names like 'USD INDEX%')" },
  { key: 'GOLD', label: 'Gold', where: "market_and_exchange_names like 'GOLD - COMMODITY EXCHANGE%'" },
  { key: 'OIL', label: 'Oil (WTI)', where: "(market_and_exchange_names like 'WTI%NEW YORK MERCANTILE%' OR market_and_exchange_names like 'CRUDE OIL, LIGHT SWEET%NEW YORK MERCANTILE%')" },
  { key: 'SPX', label: 'S&P 500 (E-mini)', where: "market_and_exchange_names like 'E-MINI S&P 500%'" },
  { key: 'BTC', label: 'Bitcoin', where: "market_and_exchange_names like 'BITCOIN - CHICAGO MERCANTILE%'" },
];

type Raw = { cftc_contract_market_code?: string; market_and_exchange_names?: string; report_date_as_yyyy_mm_dd?: string; noncomm_positions_long_all?: string; noncomm_positions_short_all?: string; open_interest_all?: string };

async function get(params: Record<string, string>): Promise<Raw[]> {
  const u = new URL(URL_);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.CFTC_APP_TOKEN) headers['X-App-Token'] = process.env.CFTC_APP_TOKEN;
  const r = await fetch(u, { headers, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!r.ok) throw new Error(`CFTC HTTP ${r.status}`);
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('CFTC: unexpected answer');
  return d as Raw[];
}

/** Pure: the main contract = the one with the largest open interest on the latest report (tested). */
export function mainContract(rows: Raw[]): string | null {
  if (!rows.length) return null;
  const latest = rows.map((r) => String(r.report_date_as_yyyy_mm_dd || '')).sort().pop()!;
  const best = rows.filter((r) => r.report_date_as_yyyy_mm_dd === latest).sort((a, b) => Number(b.open_interest_all || 0) - Number(a.open_interest_all || 0))[0];
  return best?.cftc_contract_market_code || null;
}

export async function refreshCot(force = false): Promise<string | null> {
  const q = await db();
  if (!force && !(await claim(q, 'cot', 12 * 60))) return null;
  const since = new Date(Date.now() - 3 * 366 * 86400000).toISOString().slice(0, 10);
  const recent = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const done: string[] = [], failed: string[] = [];
  for (const m of COT_MARKETS) {
    try {
      const cands = await get({ $select: 'cftc_contract_market_code,market_and_exchange_names,report_date_as_yyyy_mm_dd,open_interest_all', $where: `${m.where} AND report_date_as_yyyy_mm_dd >= '${recent}'`, $limit: '50' });
      const code = mainContract(cands);
      if (!code) { failed.push(m.key); continue; }
      const rows = await get({ $where: `cftc_contract_market_code = '${code.replace(/[^0-9A-Z+]/gi, '')}' AND report_date_as_yyyy_mm_dd >= '${since}'`, $order: 'report_date_as_yyyy_mm_dd', $limit: '400' });
      for (const r of rows) {
        const long = Number(r.noncomm_positions_long_all), short = Number(r.noncomm_positions_short_all);
        if (!r.report_date_as_yyyy_mm_dd || !Number.isFinite(long) || !Number.isFinite(short)) continue;
        await q`INSERT INTO mi_cot (code, market, report_date, long, short, open_interest) VALUES (${code}, ${m.key}, ${r.report_date_as_yyyy_mm_dd.slice(0, 10)}, ${long}, ${short}, ${Number(r.open_interest_all) || null})
          ON CONFLICT (code, report_date) DO UPDATE SET long = EXCLUDED.long, short = EXCLUDED.short, open_interest = EXCLUDED.open_interest, market = EXCLUDED.market`;
      }
      done.push(m.key);
    } catch {
      failed.push(m.key);
    }
  }
  const msg = `ok ${done.join(',')}${failed.length ? `; failed ${failed.join(',')}` : ''}`;
  await note(q, 'cot', done.length > 0, msg, 60);
  return msg;
}

export type CotRow = { key: string; label: string; date: string; net: number; change: number | null; long: number; short: number; pctile: number | null; history: { date: string; net: number }[] };

/** Pure: net position, weekly change and where today's net sits in the last 3 years (0 = most short, 100 = most long). */
export function cotSummary(key: string, label: string, hist: { date: string; long: number; short: number }[]): CotRow | null {
  if (!hist.length) return null;
  const h = [...hist].sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ date: x.date, net: x.long - x.short, long: x.long, short: x.short }));
  const last = h[h.length - 1], prev = h[h.length - 2];
  const nets = h.map((x) => x.net);
  const lo = Math.min(...nets), hi = Math.max(...nets);
  return {
    key, label, date: last.date, net: last.net, long: last.long, short: last.short,
    change: prev ? last.net - prev.net : null,
    pctile: h.length >= 26 && hi > lo ? Math.round(((last.net - lo) / (hi - lo)) * 100) : null,
    history: h.slice(-52).map((x) => ({ date: x.date, net: x.net })),
  };
}

export function crowd(p: number | null) {
  if (p == null) return 'Not enough history';
  if (p >= 90) return 'Crowded long';
  if (p >= 70) return 'Leaning long';
  if (p <= 10) return 'Crowded short';
  if (p <= 30) return 'Leaning short';
  return 'Middle of the range';
}

export async function cotTable(): Promise<CotRow[]> {
  const q = await db();
  const rows = (await q`SELECT market, code, to_char(report_date, 'YYYY-MM-DD') AS date, long::float8 AS long, short::float8 AS short FROM mi_cot
    WHERE report_date > now() - interval '3 years' ORDER BY market, report_date`) as { market: string; code: string; date: string; long: number; short: number }[];
  return COT_MARKETS.map((m) => {
    const mine = rows.filter((r) => r.market === m.key);
    const code = mine[mine.length - 1]?.code; // the contract used in the latest report
    return cotSummary(m.key, m.label, mine.filter((r) => r.code === code));
  }).filter((x): x is CotRow => !!x);
}
