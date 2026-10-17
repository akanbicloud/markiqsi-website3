import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { TerminalView } from '@/components/terminal/TerminalView';

export const metadata: Metadata = {
  title: 'Market Terminal',
  description: 'Gold, EUR/USD, GBP/USD, USD/JPY, the S&P 500 and Bitcoin on one-hour charts with every big release and headline pinned to the candle, the MarkIQ Pressure band, and a click-to-explain for any candle.',
  alternates: { canonical: '/markets/terminal' },
};

export default function TerminalPage() {
  return (
    <>
      <MarketsNav active="/markets/terminal" />
      <Suspense>
        <TerminalView />
      </Suspense>
    </>
  );
}
