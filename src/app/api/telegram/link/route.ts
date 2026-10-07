import { db } from '@/lib/db';
import { fail, json } from '@/lib/http';
import { randomToken } from '@/lib/crypto';
import { getSession } from '@/lib/session';

export async function POST() {
  const s = await getSession();
  if (!s) return fail('Please log in first.', 401);
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!bot) return fail('Telegram is not set up yet.', 503);
  const code = 'mq_' + randomToken(12);
  const q = await db();
  await q`INSERT INTO mq_telegram_links (code, user_id, expires_at) VALUES (${code}, ${s.uid}, now() + interval '30 minutes')`;
  return json({ ok: true, url: `https://t.me/${bot.replace(/^@/, '')}?start=${code}` });
}

export async function DELETE() {
  const s = await getSession();
  if (!s) return fail('Please log in first.', 401);
  const q = await db();
  await q`UPDATE mq_users SET telegram_chat_id = NULL, telegram_username = NULL WHERE id = ${s.uid}`;
  return json({ ok: true });
}
