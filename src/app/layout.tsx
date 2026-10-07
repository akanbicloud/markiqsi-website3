import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BackToTop } from '@/components/BackToTop';
import { currentUser } from '@/lib/users';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'MarkIQ SI · Market Intelligence & Academy', template: '%s · MarkIQ SI' },
  description: 'Live market alerts from official data, trading courses, and the tools to build, test and run your own trading bots.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'MarkIQ SI · Learn the Market. Build the Technology.',
    description: 'Live market alerts, trading courses, and the tools to build, test and run your own trading bots.',
    url: SITE.url,
    siteName: 'MarkIQ SI',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1A36',
};

const themeScript = `try{var t=localStorage.getItem('mq-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    user = await currentUser();
  } catch {
    user = null;
  }
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Header signedIn={!!user} firstName={user?.name?.split(' ')[0] || null} />
        <main id="main">{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
