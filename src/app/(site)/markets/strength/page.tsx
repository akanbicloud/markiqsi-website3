import type { Metadata } from 'next';
import { hasDb } from '@/lib/db';
import { cachedCandles } from '@/lib/terminal/data';
import { LEGS, PERIODS, strength, strengthPath } from '@/lib/terminal/strength';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { StrengthView } from '@/components/terminal/StrengthView';

export const metadata: Metadata = {
  title: 'Currency Strength',
  description: 'Which of the eight major currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD) is strongest and weakest today, over 24 hours, a week and a month.',
  alternates: { canonical: '/markets/strength' },
};

export default async function StrengthPage() {
  let periods: { key: string; label: string; s: Record<string, number> | null }[] = [];
  let path: { t: number; s: Record<string, number> | null }[] = [];
  let error = '';
  if (!hasDb()) error = 'Currency strength is not connected yet.';
  else {
    try {
      const pairs = Object.keys(LEGS);
      const [h1, d1] = await Promise.all([cachedCandles(pairs, '1h'), cachedCandles(pairs, '1day')]);
      const now = Date.now();
      periods = PERIODS.map((p) => ({ key: p.key, label: p.label, s: strength(p.tf === '1h' ? h1 : d1, p.from(now)) }));
      path = strengthPath(h1, 48, now);
    } catch {
      error = 'Currency strength is temporarily unavailable.';
    }
  }
  return (
    <>
      <MarketsNav active="/markets/strength" />
      <StrengthView periods={periods} path={path} error={error} />
    </>
  );
}
