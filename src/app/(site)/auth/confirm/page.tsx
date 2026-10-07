import type { Metadata } from 'next';
import { ConfirmLogin } from '@/components/ConfirmLogin';

export const metadata: Metadata = { title: 'Confirm', robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmLogin token={token || ''} />;
}
