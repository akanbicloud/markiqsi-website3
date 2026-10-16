'use client';

import { useState } from 'react';

export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
      <code style={{ fontSize: 14, wordBreak: 'break-all' }}>{text}</code>
      <button type="button" className="btn btn-outline" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }).catch(() => null); }}>
        {done ? 'Copied ✓' : label}
      </button>
    </div>
  );
}
