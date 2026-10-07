import type { Metadata } from 'next';
import { LegalDoc } from '@/components/Prose';
import { TERMS } from '@/lib/content/legal';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return <LegalDoc title="Terms of Use" intro="The rules for using MarkIQ SI, written in plain English." sections={TERMS} prefix="terms" />;
}
