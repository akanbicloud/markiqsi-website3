'use client';

import { useMemo, useState } from 'react';

type Student = { enrolment: number; name: string; email: string; course: string; slug: string; attended: number; today: boolean | null };

export function AdminAttendance({ students, day, courses }: { students: Student[]; day: string; courses: { slug: string; title: string }[] }) {
  const [course, setCourse] = useState(courses[0]?.slug || '');
  const [mark, setMark] = useState<Record<number, boolean>>(Object.fromEntries(students.map((s) => [s.enrolment, s.today ?? true])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const list = useMemo(() => students.filter((s) => s.slug === course), [students, course]);

  async function save() {
    setMsg(null);
    const present = list.filter((s) => mark[s.enrolment]).map((s) => s.enrolment);
    const absent = list.filter((s) => !mark[s.enrolment]).map((s) => s.enrolment);
    const r = await fetch('/api/admin/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day, present, absent }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok && d.ok ? { ok: true, text: `Saved: ${present.length} present, ${absent.length} absent on ${day}.` } : { ok: false, text: d.error || 'Could not save.' });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form className="row" style={{ gap: 12, alignItems: 'flex-end' }} method="get">
        <label className="field" style={{ margin: 0 }}>Class date<input className="input" type="date" name="day" defaultValue={day} /></label>
        <button type="submit" className="btn btn-outline">Open this date</button>
      </form>
      <label className="field" style={{ margin: 0, maxWidth: 480 }}>Course
        <select className="input select" value={course} onChange={(e) => setCourse(e.target.value)}>
          {courses.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
        </select>
      </label>
      {list.length === 0 ? <p className="muted">No paid physical-class students for this course yet.</p> : (
        <div className="stack" style={{ gap: 8 }}>
          {list.map((s) => (
            <label key={s.enrolment} className="card row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <span className="stack" style={{ gap: 2 }}>
                <strong>{s.name || s.email}</strong>
                <span className="faint" style={{ fontSize: 14 }}>{s.email} · attended {s.attended} so far</span>
              </span>
              <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!mark[s.enrolment]} onChange={(e) => setMark({ ...mark, [s.enrolment]: e.target.checked })} style={{ width: 22, height: 22 }} />
                {mark[s.enrolment] ? 'Present' : 'Absent'}
              </span>
            </label>
          ))}
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={save}>Save register for {day}</button>
        </div>
      )}
      {msg && <div className={`note ${msg.ok ? 'note-ok' : 'note-bad'}`}>{msg.text}</div>}
    </div>
  );
}
