import { db, hasDb } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';
import { sanitizeIndicator } from '@/lib/trading/indicatorspec';

export async function GET() {
  const s = await getSession();
  if (!s || !hasDb()) return json({ ok: true, indicators: [], signedIn: !!s });
  const q = await db();
  const indicators = await q`SELECT id, name, description, spec, updated_at FROM mq_indicators WHERE user_id = ${s.uid} ORDER BY updated_at DESC LIMIT 50`;
  return json({ ok: true, indicators, signedIn: true });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Create a free account to save your indicator.', 401);
  if (!hasDb()) return fail('Saving is not connected yet.', 503);
  const b = await body(req);
  const spec = sanitizeIndicator(b.spec as never);
  const description = str(b.description, 2000);
  const id = Number(b.id) || 0;
  const q = await db();
  const count = (await q`SELECT count(*)::int AS n FROM mq_indicators WHERE user_id = ${s.uid}`) as { n: number }[];
  if (!id && count[0].n >= 50) return fail('You can save up to 50 indicators. Delete one first.');
  const rows = id
    ? await q`UPDATE mq_indicators SET name = ${spec.name}, description = ${description}, spec = ${JSON.stringify(spec)}, updated_at = now() WHERE id = ${id} AND user_id = ${s.uid} RETURNING id`
    : await q`INSERT INTO mq_indicators (user_id, name, description, spec) VALUES (${s.uid}, ${spec.name}, ${description}, ${JSON.stringify(spec)}) RETURNING id`;
  if (!(rows as unknown[]).length) return fail('Indicator not found.', 404);
  return json({ ok: true, id: (rows as { id: number }[])[0].id });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in.', 401);
  const id = Number(new URL(req.url).searchParams.get('id'));
  const q = await db();
  await q`DELETE FROM mq_indicators WHERE id = ${id} AND user_id = ${s.uid}`;
  return json({ ok: true });
}
