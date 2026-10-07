import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Get Started' };

export default async function GetStartedPage() {
  if (await getSession()) redirect('/account');
  return <AuthForm initialMode="signup" />;
}
