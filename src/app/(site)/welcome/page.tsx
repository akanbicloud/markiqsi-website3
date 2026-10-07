import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { Onboarding } from '@/components/Onboarding';

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } };

export default async function WelcomePage() {
  const u = await currentUser().catch(() => null);
  if (!u) redirect('/login');
  return <Onboarding firstName={(u.name || '').split(' ')[0] || 'trader'} />;
}
