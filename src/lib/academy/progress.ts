import { db } from '../db';
import type { Course } from '../content/courses';
import { randomInt } from 'crypto';

/** Lesson ids are "module-lesson" positions in the course outline, e.g. "0-2". */
export function lessonKeys(c: Course): string[] {
  return c.outline.flatMap((w, i) => w.lessons.map((_, j) => `${i}-${j}`));
}

export async function progressFor(userId: number, slug: string): Promise<string[]> {
  const q = await db();
  return ((await q`SELECT lesson FROM mq_progress WHERE user_id = ${userId} AND course_slug = ${slug}`) as { lesson: string }[]).map((r) => r.lesson);
}

export type Certificate = { id: string; user_id: number; course_slug: string; name: string; format: string | null; issued_at: string; revoked: boolean };

export async function certificatesFor(userId: number): Promise<Certificate[]> {
  const q = await db();
  return (await q`SELECT id, user_id, course_slug, name, format, issued_at, revoked FROM mq_certificates WHERE user_id = ${userId} AND NOT revoked`) as Certificate[];
}

export async function certificateById(id: string): Promise<Certificate | null> {
  if (!/^MQ-\d{4}-[A-Z0-9]{6}$/.test(id)) return null;
  const q = await db();
  return ((await q`SELECT id, user_id, course_slug, name, format, issued_at, revoked FROM mq_certificates WHERE id = ${id}`) as Certificate[])[0] || null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCertificateId(now = new Date()) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `MQ-${now.getUTCFullYear()}-${s}`;
}

export async function attendanceFor(userId: number): Promise<Record<string, number>> {
  const q = await db();
  const rows = (await q`SELECT e.course_slug, count(*)::int AS n FROM mq_attendance a JOIN mq_enrolments e ON e.id = a.enrolment_id
    WHERE e.user_id = ${userId} AND a.present GROUP BY e.course_slug`) as { course_slug: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.course_slug, r.n]));
}
