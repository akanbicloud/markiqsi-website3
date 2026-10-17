'use client';

import { useEffect, useState } from 'react';
import type { ChartData } from '@/lib/terminal/data';

export function useChart(market: string, bars = 240) {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    fetch(`/api/terminal/chart?market=${encodeURIComponent(market)}&bars=${bars}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok || !d.ok) { setError(d.error || 'The chart could not load. Please try again soon.'); setData(null); }
        else setData(d as ChartData);
      })
      .catch(() => live && setError('The chart could not load. Check your connection.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [market, bars]);
  return { data, error, loading };
}
