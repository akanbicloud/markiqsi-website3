import { safeError } from '../http';
import { db } from '../db';
import { esc, sendTelegram } from '../telegram';
import { runAll } from './detect';
import { closedOnly, digitsFor } from './prices';
import { SYMBOLS, STRATEGIES, TIMEFRAMES, TF_KEYS, findSymbol, type TF } from './symbols';
import { ema } from './indicators';
import type { Candle } from './indicators';
import { sanitizeRules, signalSeries } from './botspec';

export type ScanRow = { setup_key: string; symbol: string; timeframe: string; strategy: string; direction: string; strength: number; detail: string; bar_time: string; found_at: string };

const tfLabel = (tf: string) => TIMEFRAMES.find((t) => t.key === tf)?.label || tf;

/** Runs every detector on cached series (all, or only some) and stores new setups. */
export async function scanAll(only?: { symbols: string[]; tfs: string[] }) {
  const q = await db();
  const rows = (only
    ? await q`SELECT symbol, timeframe, candles FROM mq_price_cache WHERE timeframe = ANY(${only.tfs}) AND symbol = ANY(${only.symbols}) AND error IS NULL`
    : await q`SELECT symbol, timeframe, candles FROM mq_price_cache WHERE timeframe = ANY(${TF_KEYS}) AND error IS NULL AND fetched_at > now() - interval '3 days'`) as { symbol: string; timeframe: TF; candles: Candle[] }[];
  let found = 0;
  for (const r of rows) {
    const sym = findSymbol(r.symbol);
    if (!sym || !r.candles?.length) continue;
    const c = closedOnly(r.candles, r.timeframe);
    if (c.length < 80) continue;
    const barTime = new Date(c[c.length - 1].t).toISOString();
    const setups = runAll(c, digitsFor(sym));
    for (const s of setups) {
      const key = `${sym.key}|${r.timeframe}|${s.strategy}|${s.direction}|${barTime}`;
      const ins = (await q`INSERT INTO mq_scan_results (setup_key, symbol, timeframe, strategy, direction, strength, detail, bar_time)
        VALUES (${key}, ${sym.key}, ${r.timeframe}, ${s.strategy}, ${s.direction}, ${s.strength}, ${s.detail}, ${barTime})
        ON CONFLICT (setup_key) DO NOTHING RETURNING setup_key`) as unknown[];
      found += ins.length;
    }
  }
  await q`DELETE FROM mq_scan_results WHERE found_at < now() - interval '4 days'`;
  return { series: rows.length, newSetups: found };
}

/** Current setups: the latest bar's results for each series. */
export async function currentSetups(): Promise<ScanRow[]> {
  const q = await db();
  const rows = (await q`SELECT r.* FROM mq_scan_results r
    JOIN (SELECT symbol, timeframe, max(bar_time) AS bt FROM mq_scan_results GROUP BY symbol, timeframe) m
      ON m.symbol = r.symbol AND m.timeframe = r.timeframe AND m.bt = r.bar_time
    WHERE r.found_at > now() - interval '3 days'
    ORDER BY r.strength DESC, r.found_at DESC LIMIT 400`) as ScanRow[];
  // keep only setups from the newest closed candle of each series
  // a setup stays "current" until its candle is a couple of candles old
  const ages: Record<string, number> = { '1min': 0.06, '5min': 0.25, '15min': 0.75, '30min': 1.5, '1h': 3, '4h': 10, '1day': 80, '1week': 400, '1month': 1700 };
  return rows
    .map((r) => ({ ...r, bar_time: new Date(r.bar_time).toISOString(), found_at: new Date(r.found_at).toISOString() }))
    .filter((r) => Date.now() - new Date(r.bar_time).getTime() < (ages[r.timeframe] || 3) * 3600000);
}

/** Runs a user's own Bot Builder rules on cached candles. */
export async function scanMine(rulesRaw: unknown, timeframes: string[]) {
  const rules = sanitizeRules(rulesRaw as never);
  const q = await db();
  const rows = (await q`SELECT symbol, timeframe, candles FROM mq_price_cache WHERE timeframe = ANY(${timeframes}) AND error IS NULL`) as { symbol: string; timeframe: TF; candles: Candle[] }[];
  const out: ScanRow[] = [];
  for (const r of rows) {
    const c = closedOnly(r.candles || [], r.timeframe);
    if (c.length < 60) continue;
    const sig = signalSeries(rules, c);
    for (let k = c.length - 1; k >= c.length - 2; k--) {
      if (sig[k] !== 0) {
        const barTime = new Date(c[k].t).toISOString();
        out.push({ setup_key: `${r.symbol}|${r.timeframe}|mine|${barTime}`, symbol: r.symbol, timeframe: r.timeframe, strategy: 'mine', direction: sig[k] === 1 ? 'Bullish' : 'Bearish', strength: 3, detail: `Your rule matched (${rules.name}).`, bar_time: barTime, found_at: barTime });
        break;
      }
    }
  }
  return out;
}

type Context = { news: Map<string, string>; bias: Map<string, string>; trend: Map<string, number> };

/** Trend of every cached series (20 EMA vs 50 EMA), used to confirm setups with a higher timeframe. */
async function trends() {
  const q = await db();
  const rows = (await q`SELECT symbol, timeframe, candles FROM mq_price_cache WHERE error IS NULL AND timeframe = ANY(${TF_KEYS})`) as { symbol: string; timeframe: TF; candles: Candle[] }[];
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = closedOnly(r.candles || [], r.timeframe);
    if (c.length < 60) continue;
    const cl = c.map((x) => x.c);
    const L = cl.length - 1;
    const e20 = ema(cl, 20)[L];
    const e50 = ema(cl, 50)[L];
    m.set(`${r.symbol}|${r.timeframe}`, e20 > e50 && cl[L] > e50 ? 1 : e20 < e50 && cl[L] < e50 ? -1 : 0);
  }
  return m;
}

export async function fundamentalsContext(): Promise<Context> {
  const q = await db();
  // News and rates come from the market bot. If its tables are missing or different, scan without them.
  const safe = (p: Promise<Record<string, unknown>[]>) => p.catch((e) => { console.warn('fundamentals', safeError(e)); return []; });
  const [events, rates] = await Promise.all([
    safe(q`SELECT currency, name, scheduled_at FROM mi_events WHERE impact = 'High' AND scheduled_at > now() AND scheduled_at < now() + interval '24 hours' ORDER BY scheduled_at`),
    safe(q`SELECT bank, currency, rate FROM mi_rates`),
  ]);
  const news = new Map<string, string>();
  for (const e of events as { currency: string; name: string; scheduled_at: string }[]) {
    if (news.has(e.currency)) continue;
    const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(e.scheduled_at));
    news.set(e.currency, `${e.name}, ${t} WAT`);
  }
  const rate = new Map<string, number>();
  for (const r of rates as { currency: string; rate: string }[]) {
    const n = parseFloat(String(r.rate).replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(n)) rate.set(r.currency, n);
  }
  const bias = new Map<string, string>();
  for (const s of SYMBOLS.filter((x) => x.group === 'Forex')) {
    const [a, b] = s.currencies;
    const ra = rate.get(a);
    const rb = rate.get(b);
    if (ra == null || rb == null) continue;
    if (Math.abs(ra - rb) < 0.25) bias.set(s.key, `${a} and ${b} interest rates are close (${ra}% vs ${rb}%).`);
    else bias.set(s.key, `${ra > rb ? a : b} has the higher interest rate (${ra}% vs ${rb}%), which tends to support it.`);
  }
  return { news, bias, trend: await trends() };
}

export function enrich(rows: ScanRow[], ctx: Context) {
  return rows.map((r) => {
    const sym = findSymbol(r.symbol);
    const newsAhead = (sym?.currencies || []).map((c) => ctx.news.get(c)).filter(Boolean)[0] || '';
    const htf = TIMEFRAMES.find((t) => t.key === r.timeframe)?.higher || null;
    const ht = htf ? ctx.trend.get(`${r.symbol}|${htf}`) : undefined;
    const dir = r.direction === 'Bullish' ? 1 : -1;
    return {
      htfLabel: htf ? tfLabel(htf) : '',
      htfTrend: ht === undefined ? 'unknown' : ht === 1 ? 'up' : ht === -1 ? 'down' : 'flat',
      htfAgrees: ht !== undefined && ht === dir,
      ...r,
      label: sym?.label || r.symbol,
      group: sym?.group || '',
      tv: sym?.tv || '',
      tfLabel: tfLabel(r.timeframe),
      strategyLabel: STRATEGIES.find((s) => s.key === r.strategy)?.label || 'My strategy',
      news: newsAhead,
      bias: ctx.bias.get(r.symbol) || '',
    };
  });
}

/** Sends Telegram messages for new setups that match each user's saved alert. */
export async function sendScanAlerts() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { sent: 0, skipped: 'no telegram token' };
  const q = await db();
  const subs = (await q`SELECT a.user_id, a.markets, a.timeframes, a.strategies, a.bot_id, u.telegram_chat_id
    FROM mq_scan_alerts a JOIN mq_users u ON u.id = a.user_id WHERE a.active AND u.telegram_chat_id IS NOT NULL`) as { user_id: number; markets: string[]; timeframes: string[]; strategies: string[]; bot_id: number | null; telegram_chat_id: string }[];
  if (!subs.length) return { sent: 0 };
  const fresh = (await q`SELECT * FROM mq_scan_results WHERE found_at > now() - interval '30 minutes'`) as ScanRow[];
  const ctx = await fundamentalsContext();
  let sent = 0;
  for (const s of subs) {
    let rows = fresh.filter((r) => s.strategies.includes(r.strategy) && s.timeframes.includes(r.timeframe) && s.markets.includes(findSymbol(r.symbol)?.group || ''));
    if (s.bot_id && s.strategies.includes('mine')) {
      const b = (await q`SELECT rules FROM mq_bots WHERE id = ${s.bot_id} AND user_id = ${s.user_id}`) as { rules: unknown }[];
      if (b[0]) {
        const mine = (await scanMine(b[0].rules, s.timeframes)).filter((r) => Date.now() - new Date(r.bar_time).getTime() < 6 * 3600000);
        rows = rows.concat(mine.filter((r) => s.markets.includes(findSymbol(r.symbol)?.group || '')));
      }
    }
    for (const r of enrich(rows, ctx).slice(0, 10)) {
      const ins = (await q`INSERT INTO mq_scan_sent (user_id, setup_key) VALUES (${s.user_id}, ${r.setup_key}) ON CONFLICT DO NOTHING RETURNING setup_key`) as unknown[];
      if (!ins.length) continue;
      const text = [
        `<b>MarkIQ SI Scanner · ${esc(r.label)} ${esc(r.tfLabel)}</b>`,
        `${r.direction === 'Bullish' ? '🟢' : '🔴'} ${esc(r.direction)} · ${esc(r.strategyLabel)} · strength ${r.strength}/5`,
        esc(r.detail),
        r.news ? `⚠️ News ahead: ${esc(r.news)}` : '',
        r.bias ? `Fundamentals: ${esc(r.bias)}` : '',
        '<i>A setup is not a signal to buy or sell. Test on demo first.</i>',
      ].filter(Boolean).join('\n');
      try {
        await sendTelegram(s.telegram_chat_id, text);
        sent++;
      } catch (e) {
        console.error('telegram send failed', safeError(e));
      }
    }
  }
  await q`DELETE FROM mq_scan_sent WHERE sent_at < now() - interval '7 days'`;
  return { sent };
}

/** Sends event reminders 15 minutes before the event. */
export async function sendEventReminders() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { sent: 0 };
  const q = await db();
  const due = (await q`SELECT r.user_id, r.event_id, u.telegram_chat_id, e.name, e.country, e.currency, e.scheduled_at, e.forecast, e.previous, e.why
    FROM mq_event_reminders r
    JOIN mq_users u ON u.id = r.user_id
    JOIN mi_events e ON e.id = r.event_id
    WHERE r.sent_at IS NULL AND u.telegram_chat_id IS NOT NULL
      AND e.scheduled_at <= now() + interval '16 minutes' AND e.scheduled_at > now() - interval '5 minutes'`) as { user_id: number; event_id: string; telegram_chat_id: string; name: string; country: string; currency: string; scheduled_at: string; forecast: string | null; previous: string | null; why: string | null }[];
  let sent = 0;
  for (const d of due) {
    const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d.scheduled_at));
    const text = [`⏰ <b>Coming up at ${t} WAT: ${esc(d.name)}</b> (${esc(d.country)} · ${esc(d.currency)})`, d.forecast ? `Expected: ${esc(d.forecast)}` : '', d.previous ? `Last time: ${esc(d.previous)}` : '', d.why ? esc(d.why) : ''].filter(Boolean).join('\n');
    try {
      await sendTelegram(d.telegram_chat_id, text);
      await q`UPDATE mq_event_reminders SET sent_at = now() WHERE user_id = ${d.user_id} AND event_id = ${d.event_id}`;
      sent++;
    } catch (e) {
      console.error('reminder failed', safeError(e));
    }
  }
  return { sent };
}
