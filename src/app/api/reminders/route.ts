import { db } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in to set reminders.', 401);
  const b = await body(req);
  const id = str(b.eventId, 120);
  if (!id) return fail('Missing event.');
  const q = await db();
  const u = (await q`SELECT telegram_chat_id FROM mq_users WHERE id = ${s.uid}`) as { telegram_chat_id: string | null }[];
  await q`INSERT INTO mq_event_reminders (user_id, event_id) VALUES (${s.uid}, ${id}) ON CONFLICT DO NOTHING`;
  return json({ ok: true, telegram: !!u[0]?.telegram_chat_id });
}
