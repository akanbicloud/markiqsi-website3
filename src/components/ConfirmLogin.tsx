'use client';

import Link from 'next/link';
import { useState } from 'react';

export function ConfirmLogin({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(token ? '' : 'This link is not complete. Please open the link from your email again.');

  async function go() {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
      window.location.href = d.next || '/account';
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="wrap" style={{ padding: '80px 16px 140px', maxWidth: 760 }}>
      <div className="card-lg stack" style={{ gap: 20 }}>
        <h1 className="display" style={{ fontWeight: 700, fontSize: 'clamp(34px, 4.4vw, 54px)', lineHeight: 1.04 }}>One more click</h1>
        <p style={{ margin: 0, fontSize: 19, color: 'var(--text)' }}>Press the button to finish logging in to MarkIQ SI on this device.</p>
        {err && <div role="alert" className="note note-bad">{err} <Link href="/login">Get a new link</Link></div>}
        {token && (
          <button type="button" className="btn" onClick={go} disabled={busy} style={{ alignSelf: 'flex-start', minHeight: 64, fontSize: 20 }}>
            {busy ? <span className="spinner" aria-label="Logging in" /> : 'Continue'} <span className="arr" aria-hidden="true">»</span>
          </button>
        )}
      </div>
    </section>
  );
}
