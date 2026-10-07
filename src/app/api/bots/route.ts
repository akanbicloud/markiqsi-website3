import { db } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { sanitizeRules } from '@/lib/trading/botspec';

export async function GET() {
  const s = await getSession();
  if (!s) return json({ ok: true, bots: [], signedIn: false });
  const q = await db();
  const bots = await q`SELECT id, name, description, rules, updated_at FROM mq_bots WHERE user_id = ${s.uid} ORDER BY updated_at DESC LIMIT 50`;
  return json({ ok: true, bots, signedIn: true });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in to save your bot.', 401);
  const b = await body(req);
  const rules = sanitizeRules(b.rules as never);
  const description = str(b.description, 2000);
  const id = Number(b.id) || 0;
  const q = await db();
  const count = (await q`SELECT count(*)::int AS n FROM mq_bots WHERE user_id = ${s.uid}`) as { n: number }[];
  if (!id && count[0].n >= 50) return fail('You can save up to 50 bots. Delete one first.');
  const rows = id
    ? await q`UPDATE mq_bots SET name = ${rules.name}, description = ${description}, rules = ${JSON.stringify(rules)}, updated_at = now() WHERE id = ${id} AND user_id = ${s.uid} RETURNING id`
    : await q`INSERT INTO mq_bots (user_id, name, description, rules) VALUES (${s.uid}, ${rules.name}, ${description}, ${JSON.stringify(rules)}) RETURNING id`;
  if (!(rows as unknown[]).length) return fail('Bot not found.', 404);
  return json({ ok: true, id: (rows as { id: number }[])[0].id });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in.', 401);
  const id = Number(new URL(req.url).searchParams.get('id'));
  const q = await db();
  await q`DELETE FROM mq_bots WHERE id = ${id} AND user_id = ${s.uid}`;
  return json({ ok: true });
}
