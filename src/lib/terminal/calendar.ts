import { db } from '../db';
import { historyLabel } from './playbook';

export type CalRow = {
  id: string; country: string; currency: string; name: string; impact: string; scheduled_at: string; what: string | null; why: string | null;
  forecast: string | null; previous: string | null; actual: string | null; verdict: string | null; simply: string | null; result_source: string | null; result_url: string | null; history: boolean;
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** Events from two days ago to eight days ahead, with the official result attached when it is out. */
export async function calendarRows(): Promise<CalRow[]> {
  const q = await db();
  const rows = (await q`
    SELECT e.id, e.country, e.currency, e.name, e.impact, e.scheduled_at, e.what, e.why, e.forecast, e.previous,
      r.actual, r.verdict, r.simply, r.source AS result_source, r.source_url AS result_url
    FROM mi_events e
    LEFT JOIN LATERAL (
      SELECT actual, verdict, simply, source, source_url FROM mi_results x
      WHERE x.event_id = e.id OR (x.country = e.country AND lower(x.name) = lower(e.name) AND x.released_at BETWEEN e.scheduled_at - interval '30 minutes' AND e.scheduled_at + interval '3 hours')
      ORDER BY (x.event_id = e.id) DESC LIMIT 1
    ) r ON TRUE
    WHERE e.scheduled_at >= now() - interval '2 days' AND e.scheduled_at < now() + interval '8 days'
    ORDER BY e.scheduled_at, e.impact LIMIT 300`) as Record<string, unknown>[];
  return rows.map((r) => ({ ...(r as unknown as CalRow), scheduled_at: iso(r.scheduled_at), history: !!historyLabel(String(r.country), String(r.name)) }));
}
