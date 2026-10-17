import type { Metadata } from 'next';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { ReplayView } from '@/components/terminal/ReplayView';

export const metadata: Metadata = {
  title: 'Event Replay',
  description: 'Replay how EUR/USD, gold, GBP/USD, USD/JPY, the S&P 500 or Bitcoin moved candle by candle around past CPI, jobs, GDP and rate releases.',
  alternates: { canonical: '/markets/replay' },
};

export default function ReplayPage() {
  return (
    <>
      <MarketsNav active="/markets/replay" />
      <ReplayView />
    </>
  );
}
