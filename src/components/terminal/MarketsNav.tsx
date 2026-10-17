import Link from 'next/link';

export const MARKET_PAGES: { href: string; label: string; icon: string; desc: string }[] = [
  { href: '/markets', label: 'Overview', icon: '🗓️', desc: 'This week’s events, rates, results and news' },
  { href: '/markets/terminal', label: 'Terminal', icon: '📈', desc: 'Every move labelled. Click a candle to see why' },
  { href: '/markets/calendar', label: 'Pro FX Calendar', icon: '⏱️', desc: 'Countdowns, live results and a playbook for every release' },
  { href: '/markets/replay', label: 'Event Replay', icon: '⏪', desc: 'Watch past releases play out candle by candle' },
  { href: '/markets/news-flow', label: 'News Flow', icon: '🧭', desc: 'Fed tone, war tone, Trump tracker and story chains' },
  { href: '/markets/strength', label: 'Currency Strength', icon: '💪', desc: 'Which of the 8 major currencies is strongest right now' },
  { href: '/markets/cot', label: 'COT Report', icon: '🧾', desc: 'What the big funds hold in futures, every week' },
];

export function MarketsNav({ active }: { active: string }) {
  return (
    <nav aria-label="Markets sections" className="wrap" style={{ padding: '28px 16px 0' }}>
      <div className="row" style={{ gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
        {MARKET_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="toggle" aria-current={active === p.href ? 'page' : undefined} aria-pressed={active === p.href} style={{ whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {p.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
