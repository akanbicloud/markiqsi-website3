import Link from 'next/link';

export const MARKET_PAGES: { href: string; label: string; icon: string; desc: string }[] = [
  { href: '/markets', label: 'Overview', icon: '🗓️', desc: 'This week’s events, rates, results and news' },
  { href: '/markets/terminal', label: 'Terminal', icon: '📈', desc: 'Every move labelled. Click a candle to see why' },
  { href: '/markets/calendar', label: 'Pro FX Calendar', icon: '⏱️', desc: 'Countdowns, live results and a playbook for every release' },
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
