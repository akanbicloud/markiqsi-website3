import { db, hasDb } from '@/lib/db';
import { fail, json, safeError } from '@/lib/http';
import { getSession } from '@/lib/session';
import { currentSetups, enrich, fundamentalsContext, scanAll, scanMine } from '@/lib/trading/scanner';
import { refreshPrices } from '@/lib/trading/prices';
import { SYMBOLS, TIMEFRAMES, findSymbol, type TF } from '@/lib/trading/symbols';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!hasDb()) return fail('The scanner is not connected yet.', 503);
  const u = new URL(req.url);
  const list = (k: string) => (u.searchParams.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean);
  const markets = list('markets');
  const tfs = list('tf');
  const strategies = list('strategies');
  const botId = Number(u.searchParams.get('bot') || 0);
  const confirmOnly = u.searchParams.get('confirm') === '1';
  try {
    const q = await db();
    // Fast timeframes are fetched when someone asks for them (they use many price-data credits).
    const fastTfs = tfs.filter((t) => TIMEFRAMES.find((x) => x.key === t && !x.background)) as TF[];
    let fastNote = '';
    if (fastTfs.length && process.env.TWELVE_DATA_API_KEY) {
      const syms = SYMBOLS.filter((s) => !markets.length || markets.includes(s.group)).map((s) => s.key);
      const ref = await refreshPrices(Number(process.env.TWELVE_DATA_PER_MINUTE || 8) - 1, { symbols: syms, tfs: fastTfs });
      if (ref.refreshed.length) await scanAll({ symbols: syms, tfs: fastTfs });
      if (ref.waiting > 0) fastNote = `Fast timeframes: ${ref.waiting} more market${ref.waiting === 1 ? '' : 's'} will load in the next minute or two. Scan again shortly to see them.`;
    }
    let rows = (await currentSetups()).filter((r) => (!tfs.length || tfs.includes(r.timeframe)) && (!strategies.length || strategies.includes(r.strategy)));
    let mineNote = '';
    if (strategies.includes('mine')) {
      const s = await getSession();
      if (!s) mineNote = 'Log in and save a bot in the Bot Builder to scan your own strategy.';
      else {
        const b = (botId
          ? await q`SELECT rules FROM mq_bots WHERE id = ${botId} AND user_id = ${s.uid}`
          : await q`SELECT rules FROM mq_bots WHERE user_id = ${s.uid} ORDER BY updated_at DESC LIMIT 1`) as { rules: unknown }[];
        if (!b[0]) mineNote = 'Save a bot in the Bot Builder first, then scan it here.';
        else rows = rows.concat(await scanMine(b[0].rules, tfs.length ? tfs : ['1h', '4h', '1day', '1week']));
      }
    }
    rows = rows.filter((r) => !markets.length || markets.includes(findSymbol(r.symbol)?.group || ''));
    const ctx = await fundamentalsContext();
    const fresh = (await q`SELECT max(fetched_at) AS t, count(*) AS total FROM mq_price_cache WHERE timeframe = ANY(${tfs.length ? tfs : ['1h']}) AND error IS NULL`) as { t: string | null; total: number }[];
    let results = enrich(rows, ctx);
    if (confirmOnly) results = results.filter((r) => r.htfAgrees);
    results.sort((a, b) => Number(b.htfAgrees) - Number(a.htfAgrees) || b.strength - a.strength);
    return json({ ok: true, results, updatedAt: fresh[0]?.t || null, series: Number(fresh[0]?.total || 0), mineNote, fastNote });
  } catch (e) {
    console.error('scanner', safeError(e));
    return json({ ok: false, error: 'The scanner could not load right now. Please try again.', detail: safeError(e) }, new URL(req.url).searchParams.has('debug') ? 200 : 500);
  }
}
