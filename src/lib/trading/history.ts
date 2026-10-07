import { db } from '../db';
import { fetchTwelve } from './prices';
import { TIMEFRAMES, type Sym, type TF } from './symbols';
import type { Candle } from './indicators';

const PAGE = 5000;

async function save(sym: Sym, tf: TF, c: Candle[]) {
  if (!c.length) return;
  const q = await db();
  for (let i = 0; i < c.length; i += 1000) {
    const part = c.slice(i, i + 1000);
    await q.query(
      `INSERT INTO mq_history (symbol, timeframe, t, o, h, l, c)
       SELECT $1, $2, * FROM unnest($3::bigint[], $4::float8[], $5::float8[], $6::float8[], $7::float8[])
       ON CONFLICT (symbol, timeframe, t) DO UPDATE SET o = EXCLUDED.o, h = EXCLUDED.h, l = EXCLUDED.l, c = EXCLUDED.c`,
      [sym.key, tf, part.map((x) => x.t), part.map((x) => x.o), part.map((x) => x.h), part.map((x) => x.l), part.map((x) => x.c)],
    );
  }
}

function tdDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Returns up to `limit` candles older than `before` (or the newest ones).
 * Missing history is downloaded from Twelve Data in pages of 5,000 candles and kept,
 * so every year of history is only downloaded once.
 */
export async function getHistory(sym: Sym, tf: TF, before: number | null, limit: number) {
  const q = await db();
  const tfi = TIMEFRAMES.find((t) => t.key === tf)!;
  const meta = ((await q`SELECT oldest_reached, newest_fetched_at FROM mq_history_meta WHERE symbol = ${sym.key} AND timeframe = ${tf}`) as { oldest_reached: boolean; newest_fetched_at: string | null }[])[0];

  if (!before) {
    const stale = !meta?.newest_fetched_at || Date.now() - new Date(meta.newest_fetched_at).getTime() > Math.max(1, tfi.refreshMinutes) * 60000;
    if (stale) {
      const c = await fetchTwelve(sym, tf, PAGE);
      await save(sym, tf, c);
      await q`INSERT INTO mq_history_meta (symbol, timeframe, newest_fetched_at, oldest_reached) VALUES (${sym.key}, ${tf}, now(), ${c.length < PAGE})
        ON CONFLICT (symbol, timeframe) DO UPDATE SET newest_fetched_at = now()`;
    }
  }

  const read = async () =>
    (before
      ? await q`SELECT t, o, h, l, c FROM mq_history WHERE symbol = ${sym.key} AND timeframe = ${tf} AND t < ${before} ORDER BY t DESC LIMIT ${limit}`
      : await q`SELECT t, o, h, l, c FROM mq_history WHERE symbol = ${sym.key} AND timeframe = ${tf} ORDER BY t DESC LIMIT ${limit}`) as Candle[];

  let rows = await read();
  let reachedStart = !!meta?.oldest_reached;
  if (before && rows.length < limit && !reachedStart) {
    const oldest = ((await q`SELECT min(t) AS t FROM mq_history WHERE symbol = ${sym.key} AND timeframe = ${tf}`) as { t: string | null }[])[0]?.t;
    const end = Number(oldest || before) - 1000;
    const c = await fetchTwelve(sym, tf, PAGE, tdDate(end));
    const older = c.filter((x) => x.t < Number(oldest || before));
    await save(sym, tf, older);
    if (older.length < 10) {
      reachedStart = true;
      await q`INSERT INTO mq_history_meta (symbol, timeframe, oldest_reached) VALUES (${sym.key}, ${tf}, TRUE)
        ON CONFLICT (symbol, timeframe) DO UPDATE SET oldest_reached = TRUE`;
    }
    rows = await read();
  }
  const candles = rows.map((r) => ({ t: Number(r.t), o: Number(r.o), h: Number(r.h), l: Number(r.l), c: Number(r.c) })).reverse();
  return { candles, reachedStart: reachedStart && rows.length < limit };
}
