import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolsView } from '@/components/tools/ToolsView';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Tools', description: 'Risk Calculator, Prop Challenge Tracker, Market Scanner, Charts, Bot Builder and Trading Journal.' };

export default async function ToolsPage() {
  const s = await getSession();
  return (
    <Suspense fallback={null}>
      <ToolsView signedIn={!!s} />
    </Suspense>
  );
}
