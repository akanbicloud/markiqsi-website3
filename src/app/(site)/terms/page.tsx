import type { Metadata } from 'next';
import { LegalDoc } from '@/components/Prose';
import { TERMS } from '@/lib/content/legal';

export const metadata: Metadata = { title: 'Terms of Use', description: 'The terms for using MarkIQ SI, its market information, courses and trading tools.', alternates: { canonical: '/terms' }, openGraph: { title: 'Terms of Use · MarkIQ SI', description: 'The terms for using MarkIQ SI, its market information, courses and trading tools.', url: '/terms', images: ['/og.png'] } };

export default function TermsPage() {
  return <LegalDoc title="Terms of Use" intro="The rules for using MarkIQ SI, written in plain English." sections={TERMS} prefix="terms" />;
}
