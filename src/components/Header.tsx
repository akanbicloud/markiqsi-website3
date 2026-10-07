'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

const NAV = [
  { href: '/#learn', label: 'Learn', match: '/learn' },
  { href: '/markets', label: 'Markets', match: '/markets' },
  { href: '/tools', label: 'Tools', match: '/tools' },
  { href: '/about', label: 'About', match: '/about' },
];

export function Header({ signedIn, firstName }: { signedIn: boolean; firstName?: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
  }, []);
  useEffect(() => setOpen(false), [path]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('mq-theme', next ? 'dark' : 'light');
    } catch {}
  }

  return (
    <>
      <div className="topbar" aria-hidden="true" />
      <header className="site-header">
        <div className={`site-header-bar${open ? ' open' : ''}`}>
          <Link href="/" className="brand" aria-label="MarkIQ SI home">
            <LogoMark />
            <span className="brand-name">MarkIQ SI</span>
          </Link>
          <button type="button" className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Close' : 'Menu'}
          </button>
          <nav className="main-nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path?.startsWith(n.match) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button type="button" className="theme-btn" aria-pressed={dark} onClick={toggleTheme}>
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
            {signedIn ? (
              <Link href="/account" className="btn btn-sm">
                {firstName ? `Hi, ${firstName}` : 'My account'} <span className="arr" aria-hidden="true">»</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="login-link">
                  Log in
                </Link>
                <Link href="/get-started" className="btn">
                  Get Started <span className="arr" aria-hidden="true">»</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
