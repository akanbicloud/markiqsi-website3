'use client';

import { useState } from 'react';

type Module = { week: string; title: string; lessons: string[]; practice?: string };

/** The course outline with a tick box per lesson and a progress bar (saved to the student's account). */
export function LessonChecklist({ slug, outline, initialDone }: { slug: string; outline: Module[]; initialDone: string[] }) {
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [err, setErr] = useState('');
  const total = outline.reduce((n, w) => n + w.lessons.length, 0);
  const pct = total ? Math.round((done.size / total) * 100) : 0;

  async function toggle(key: string) {
    const on = !done.has(key);
    setErr('');
    setDone((d) => { const n = new Set(d); if (on) n.add(key); else n.delete(key); return n; });
    const r = await fetch('/api/courses/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, lesson: key, done: on }) }).catch(() => null);
    if (!r || !r.ok) {
      setErr('Could not save. Check your connection and try again.');
      setDone((d) => { const n = new Set(d); if (on) n.delete(key); else n.add(key); return n; });
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Your progress</strong>
          <span>{done.size} of {total} lessons · {pct}%</span>
        </div>
        <div style={{ height: 12, borderRadius: 99, background: 'var(--inset)', overflow: 'hidden' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#16A34A', transition: 'width .3s' }} />
        </div>
        {pct === 100 && <span className="note note-ok" style={{ margin: 0 }}>Well done, you have completed every lesson! Your mentor will review your work and issue your certificate.</span>}
        {err && <span className="note note-bad" style={{ margin: 0 }}>{err}</span>}
      </div>
      {outline.map((w, i) => (
        <div key={w.week} className="card stack" style={{ gap: 10 }}>
          <span className="faint" style={{ fontSize: 14 }}>{w.week} · Module {i + 1}</span>
          <h2 className="h3" style={{ margin: 0 }}>{w.title}</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {w.lessons.map((l, j) => {
              const key = `${i}-${j}`;
              return (
                <li key={key}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', lineHeight: 1.5 }}>
                    <input type="checkbox" checked={done.has(key)} onChange={() => toggle(key)} style={{ width: 20, height: 20, marginTop: 3, flex: 'none' }} />
                    <span style={done.has(key) ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>{l}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {w.practice && <p style={{ margin: 0 }}><strong>Practice task:</strong> {w.practice}</p>}
        </div>
      ))}
    </div>
  );
}
