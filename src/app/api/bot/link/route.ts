import { db, hasDb } from '@/lib/db';
import { body, fail, json, safeError, str } from '@/lib/http';
import { botAuthorized } from '@/lib/botauth';

/**
 * The market bot calls this when someone opens the bot with /start mq_XXXX (from "Connect Telegram" on the website).
 * POST { code, chat_id, username } with header Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: Request) {
  if (!botAuthorized(req)) return fail('Not allowed', 401);
  if (!hasDb()) return fail('Database not connected', 503);
  const b = await body(req);
  const code = str(b.code, 64);
  const chatId = str(String(b.chat_id ?? ''), 32);
  const username = str(b.username, 64) || null;
  if (!/^mq_[A-Za-z0-9_-]{6,60}$/.test(code) || !/^-?\d{1,20}$/.test(chatId)) return fail('Bad request');
  try {
    const q = await db();
    const rows = (await q`
      UPDATE mq_users u SET telegram_chat_id = ${chatId}, telegram_username = ${username}
      FROM mq_telegram_links l
      WHERE l.code = ${code} AND l.user_id = u.id AND l.used_at IS NULL AND l.expires_at > now()
      RETURNING u.name`) as { name: string | null }[];
    await q`UPDATE mq_telegram_links SET used_at = now() WHERE code = ${code} AND used_at IS NULL`;
    return json({ ok: true, linked: rows.length > 0, name: rows[0]?.name || null });
  } catch (e) {
    console.error('bot link', safeError(e));
    return fail('Could not link right now', 500);
  }
}
