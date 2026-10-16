'use client';

import { useState } from 'react';

type Row = { id: number; email: string; name: string; course: string; format: string; amount: string; status: string; reference: string | null; created: string; code: string; progress: number; cert: string };

export function AdminEnrolments({ rows }: { rows: Row[] }) {
  const [list, setList] = useState(rows);
  async function set(id: number, status: string) {
    const r = await fetch('/api/admin/enrolments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    if (r.ok) setList((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    else alert('Could not update. Please try again.');
  }
  async function certify(e: Row) {
    const name = window.prompt('Full name exactly as it should appear on the certificate:', e.name || '');
    if (!name) return;
    const r = await fetch('/api/admin/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrolment_id: e.id, name }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) setList((l) => l.map((x) => (x.id === e.id ? { ...x, cert: d.id, name } : x)));
    else alert(d.error || 'Could not issue the certificate.');
  }
  if (!list.length) return <p className="muted">No enrolments yet.</p>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {list.map((e) => (
        <div key={e.id} className="card row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div className="stack" style={{ gap: 4 }}>
            <strong>{e.course}</strong>
            <span className="muted" style={{ fontSize: 15 }}>{e.email} · {e.format} · {e.amount} · {e.created}</span>
            <span className="faint" style={{ fontSize: 13 }}>Ref: {e.reference || 'none'}{e.code ? ` · code ${e.code}` : ''}{e.status === 'active' ? ` · ${e.progress}% of lessons done` : ''}</span>
            {e.cert && <a href={`/certificates/${e.cert}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>🎓 Certificate {e.cert}</a>}
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="chip">{e.status}</span>
            {e.status !== 'active' && <button type="button" className="btn" onClick={() => set(e.id, 'active')}>Mark paid</button>}
            {e.status === 'active' && <button type="button" className="btn btn-outline" onClick={() => certify(e)}>{e.cert ? 'Re-issue certificate' : 'Issue certificate'}</button>}
            {e.status !== 'cancelled' && <button type="button" className="btn btn-outline" onClick={() => set(e.id, 'cancelled')}>Cancel</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
