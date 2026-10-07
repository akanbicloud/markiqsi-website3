import { db } from '@/lib/db';
import { body, fail, json } from '@/lib/http';
import { getSession } from '@/lib/session';
import { GROUPS, STRATEGIES, TIMEFRAMES } from '@/lib/trading/symbols';

export async function GET() {
  const s = await getSession();
  if (!s) return json({ ok: true, alert: null, signedIn: false });
  const q = await db();
  const a = (await q`SELECT markets, timeframes, strategies, bot_id, active FROM mq_scan_alerts WHERE user_id = ${s.uid}`) as unknown[];
  const u = (await q`SELECT telegram_chat_id FROM mq_users WHERE id = ${s.uid}`) as { telegram_chat_id: string | null }[];
  return json({ ok: true, alert: a[0] || null, signedIn: true, telegram: !!u[0]?.telegram_chat_id });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in to turn on alerts.', 401);
  const b = await body(req);
  const pick = (v: unknown, allowed: string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)) : []);
  const markets = pick(b.markets, GROUPS);
  const timeframes = pick(b.timeframes, TIMEFRAMES.map((t) => t.key));
  const strategies = pick(b.strategies, [...STRATEGIES.map((x) => x.key), 'mine']);
  const active = b.active !== false;
  if (active && (!markets.length || !timeframes.length || !strategies.length)) return fail('Pick at least one market, timeframe and strategy.');
  const botId = Number(b.botId) || null;
  const q = await db();
  await q`INSERT INTO mq_scan_alerts (user_id, markets, timeframes, strategies, bot_id, active) VALUES (${s.uid}, ${markets}, ${timeframes}, ${strategies}, ${botId}, ${active})
    ON CONFLICT (user_id) DO UPDATE SET markets = EXCLUDED.markets, timeframes = EXCLUDED.timeframes, strategies = EXCLUDED.strategies, bot_id = EXCLUDED.bot_id, active = EXCLUDED.active`;
  const u = (await q`SELECT telegram_chat_id FROM mq_users WHERE id = ${s.uid}`) as { telegram_chat_id: string | null }[];
  return json({ ok: true, telegram: !!u[0]?.telegram_chat_id });
}
