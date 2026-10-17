import type { Metadata } from 'next';
import { hasDb } from '@/lib/db';
import { calendarRows, type CalRow } from '@/lib/terminal/calendar';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { ProCalendar } from '@/components/terminal/ProCalendar';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pro FX Calendar',
  description: 'Every big economic release for USD, EUR, GBP, JPY, CAD, AUD and CNY with a live countdown, the official result the moment it is out, and a playbook showing what the markets did the last times the number came in higher or lower than expected.',
  alternates: { canonical: '/markets/calendar' },
};

export default async function CalendarPage() {
  let rows: CalRow[] = [];
  let error = '';
  if (hasDb()) rows = await calendarRows().catch(() => { error = 'The calendar is temporarily unavailable.'; return []; });
  else error = 'The calendar is not connected yet.';
  return (
    <>
      <MarketsNav active="/markets/calendar" />
      <ProCalendar initial={rows} error={error} telegramUrl={SITE.telegram} />
    </>
  );
}
