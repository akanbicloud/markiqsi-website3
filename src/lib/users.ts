import { db, hasDb } from './db';
import { getSession } from './session';

export type User = {
  id: number;
  email: string;
  name: string | null;
  goal: string | null;
  level: string | null;
  markets: string[];
  onboarded: boolean;
  telegram_chat_id: string | null;
  telegram_username: string | null;
};

export async function currentUser(): Promise<User | null> {
  const s = await getSession();
  if (!hasDb()) return null;
  if (!s) return null;
  const q = await db();
  const rows = (await q`SELECT id, email, name, goal, level, markets, onboarded, telegram_chat_id, telegram_username FROM mq_users WHERE id = ${s.uid}`) as User[];
  const u = rows[0];
  if (!u) return null;
  return { ...u, id: Number(u.id), markets: u.markets || [] };
}
