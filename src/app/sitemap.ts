import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** Tells search engines which pages exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, '');
  const pages: [string, number][] = [['', 1], ['/markets', 0.9], ['/tools', 0.9], ['/about', 0.7], ['/get-started', 0.7], ['/faqs', 0.6], ['/terms', 0.3], ['/privacy', 0.3]];
  return pages.map(([p, priority]) => ({ url: `${base}${p}`, lastModified: new Date(), changeFrequency: p === '/markets' ? 'hourly' : 'weekly', priority }));
}
