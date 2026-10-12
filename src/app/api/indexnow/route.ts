import sitemap from '@/app/sitemap';
import { json } from '@/lib/http';
import { SITE } from '@/lib/site';

/** IndexNow key: the same value is served at /<key>.txt so Bing can confirm the site is ours. */
const KEY = '56cdc60d003dc8720b0c7abd4569ccfa';

/**
 * Tells Bing (and other IndexNow search engines, which ChatGPT search relies on) about every page.
 * Open https://www.markiqsi.com/api/indexnow?submit=1 once after adding new pages.
 */
export async function GET(req: Request) {
  const urls = sitemap().map((x) => x.url);
  if (new URL(req.url).searchParams.get('submit') !== '1') return json({ ok: true, ready: true, pages: urls.length, how: 'Add ?submit=1 to send every page to Bing via IndexNow.' });
  const host = new URL(SITE.url).hostname;
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE.url}/${KEY}.txt`, urlList: urls }),
  }).catch(() => null);
  return json({ ok: !!r && (r.status === 200 || r.status === 202), status: r?.status ?? 'network error', submitted: urls.length, note: r?.status === 403 ? 'Key not found yet: wait for the deploy to finish, then try again.' : undefined });
}
