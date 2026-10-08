import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** Search engines may read the public pages, not accounts or the API. */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/welcome', '/auth/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
