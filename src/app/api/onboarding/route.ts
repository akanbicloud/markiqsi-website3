import { db } from '@/lib/db';
import { body, fail, json } from '@/lib/http';
import { getSession } from '@/lib/session';

const GOALS = ['learn', 'alerts', 'build'];
const LEVELS = ['new', 'some', 'pro'];
const MARKETS = ['Forex', 'Gold & Oil', 'Indices', 'Stocks', 'Crypto'];

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in first.', 401);
  const b = await body(req);
  const goal = GOALS.includes(b.goal as string) ? (b.goal as string) : null;
  const level = LEVELS.includes(b.level as string) ? (b.level as string) : null;
  const markets = Array.isArray(b.markets) ? (b.markets as unknown[]).filter((m): m is string => typeof m === 'string' && MARKETS.includes(m)) : [];
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : null;
  const q = await db();
  await q`UPDATE mq_users SET goal = COALESCE(${goal}, goal), level = COALESCE(${level}, level), markets = ${markets}, onboarded = TRUE, name = COALESCE(NULLIF(${name}, ''), name) WHERE id = ${s.uid}`;
  return json({ ok: true });
}
