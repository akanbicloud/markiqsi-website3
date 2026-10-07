import { db, hasDb } from '@/lib/db';
import { fail, json } from '@/lib/http';
import { getSession } from '@/lib/session';
import { currentSetups, enrich, fundamentalsContext, scanMine } from '@/lib/trading/scanner';
import { findSymbol } from '@/lib/trading/symbols';

export async function GET(req: Request) {
  if (!hasDb()) return fail('The scanner is not connected yet.', 503);
  const u = new URL(req.url);
  const list = (k: string) => (u.searchParams.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean);
  const markets = list('markets');
  const tfs = list('tf');
  const strategies = list('strategies');
  const botId = Number(u.searchParams.get('bot') || 0);
  try {
    const q = await db();
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
        else rows = rows.concat(await scanMine(b[0].rules, tfs.length ? tfs : ['1h', '4h', '1day']));
      }
    }
    rows = rows.filter((r) => !markets.length || markets.includes(findSymbol(r.symbol)?.group || ''));
    const ctx = await fundamentalsContext();
    const fresh = (await q`SELECT max(fetched_at) AS t, count(*) FILTER (WHERE error IS NOT NULL) AS errors, count(*) AS total FROM mq_price_cache WHERE timeframe IN ('1h','4h','1day')`) as { t: string | null; errors: number; total: number }[];
    return json({ ok: true, results: enrich(rows, ctx).sort((a, b) => b.strength - a.strength), updatedAt: fresh[0]?.t || null, series: Number(fresh[0]?.total || 0), mineNote });
  } catch (e) {
    console.error('scanner', e);
    return fail('The scanner could not load right now. Please try again.', 500);
  }
}
