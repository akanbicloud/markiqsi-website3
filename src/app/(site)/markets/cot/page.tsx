import type { Metadata } from 'next';
import { hasDb } from '@/lib/db';
import { cotTable, refreshCot, type CotRow } from '@/lib/terminal/cot';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { CotView } from '@/components/terminal/CotView';

export const metadata: Metadata = {
  title: 'COT Report',
  description: 'What the big funds hold in currency, gold, oil, S&P 500 and Bitcoin futures, from the weekly CFTC Commitments of Traders report, with the weekly change and how crowded each position is.',
  alternates: { canonical: '/markets/cot' },
};

export const maxDuration = 60;

export default async function CotPage() {
  let rows: CotRow[] = [];
  let error = '';
  if (!hasDb()) error = 'The COT report is not connected yet.';
  else {
    try {
      rows = await cotTable();
      if (!rows.length) { await Promise.race([refreshCot(), new Promise((r) => setTimeout(r, 40000))]).catch(() => null); rows = await cotTable(); }
    } catch {
      error = 'The COT report is temporarily unavailable.';
    }
  }
  return (
    <>
      <MarketsNav active="/markets/cot" />
      <CotView rows={rows} error={error} />
    </>
  );
}
