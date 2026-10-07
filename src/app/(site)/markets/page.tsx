import type { Metadata } from 'next';
import { loadMarketData } from '@/lib/markets';
import { MarketsView } from '@/components/markets/MarketsView';
import { getSession } from '@/lib/session';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Markets', description: 'This week’s big economic events, central bank rates, results and news, explained in plain words.' };

export default async function MarketsPage() {
  const [data, s] = await Promise.all([loadMarketData(), getSession()]);
  return <MarketsView data={data} signedIn={!!s} telegramUrl={SITE.telegram} />;
}
