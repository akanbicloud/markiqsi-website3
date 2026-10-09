import { safeError } from '@/lib/http';
import { botAuthorized } from '@/lib/botauth';
import { db, hasDb } from '@/lib/db';
import { SYMBOLS, TIMEFRAMES, type TF } from '@/lib/trading/symbols';
import { fail, json } from '@/lib/http';
import { refreshPrices } from '@/lib/trading/prices';
import { refreshMarketFeeds } from '@/lib/marketfeed';
import { scanAll, sendEventReminders, sendScanAlerts } from '@/lib/trading/scanner';

export const maxDuration = 60;

/** The market bot calls this every 2 minutes: GET /api/cron/scanner with header "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!botAuthorized(req)) return fail('Not allowed', 401);
  if (!hasDb()) return fail('Database not connected', 503);
  const out: Record<string, unknown> = {};
  try {
    await refreshMarketFeeds(await db(), 15000).catch(() => null);
    if (process.env.TWELVE_DATA_API_KEY) {
      out.prices = await refreshPrices(4);
      // fast timeframes only for markets that someone has a Telegram alert on
      const q = await db();
      const subs = (await q`SELECT markets, timeframes FROM mq_scan_alerts WHERE active`) as { markets: string[]; timeframes: string[] }[];
      const fast = TIMEFRAMES.filter((t) => !t.background).map((t) => t.key as string);
      const tfs = Array.from(new Set(subs.flatMap((s) => s.timeframes.filter((t) => fast.includes(t))))) as TF[];
      const groups = new Set(subs.flatMap((s) => s.markets));
      if (tfs.length) out.fastPrices = await refreshPrices(3, { symbols: SYMBOLS.filter((s) => groups.has(s.group)).map((s) => s.key), tfs });
    } else out.prices = 'TWELVE_DATA_API_KEY not set';
    out.scan = await scanAll();
    out.alerts = await sendScanAlerts();
    out.reminders = await sendEventReminders();
    return json({ ok: true, ...out });
  } catch (e) {
    console.error('cron', safeError(e));
    return json({ ok: false, error: (e as Error).message, ...out }, 500);
  }
}
