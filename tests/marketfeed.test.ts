import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarPayload, categorize, newsFromRss } from '../src/lib/marketfeed';

const NOW = new Date('2026-10-12T10:00:00Z');

test('calendar: keeps High/Medium for covered countries, skips Nigeria, low impact and all-day items', () => {
  const p = calendarPayload([
    { title: 'CPI y/y', country: 'USD', date: '2026-10-14T08:30:00-04:00', impact: 'High', forecast: '3.1%', previous: '3.3%' },
    { title: 'German ZEW Economic Sentiment', country: 'EUR', date: '2026-10-13T05:00:00-04:00', impact: 'Medium', forecast: '', previous: '-8.2' },
    { title: 'Inflation', country: 'NGN', date: '2026-10-14T08:00:00-04:00', impact: 'High' },
    { title: 'Crude Oil Inventories', country: 'USD', date: '2026-10-14T10:30:00-04:00', impact: 'Low' },
    { title: 'Bank Holiday', country: 'CAD', date: '2026-10-12T00:00:00-04:00', impact: 'Holiday' },
    { title: 'French Bank Holiday', country: 'EUR', date: '2026-10-12T00:00:00-04:00', impact: 'High' },
    { title: 'GDP q/q', country: 'NZD', date: '2026-10-14T17:45:00-04:00', impact: 'High' },
  ], NOW);
  assert.deepEqual(p.events.map((e) => e.name), ['CPI y/y', 'German ZEW Economic Sentiment']);
  const cpi = p.events[0];
  assert.equal(cpi.country, 'US');
  assert.equal(cpi.scheduled_at, '2026-10-14T12:30:00.000Z');
  assert.equal(cpi.id, 'us-cpi-y-y-202610141230');
  assert.equal(cpi.forecast, '3.1%');
  assert.ok(cpi.what && cpi.why);
  assert.equal(p.events[1].forecast, null);
});

test('calendar: central bank rates from rate decisions (votes ignored, deposit rate preferred)', () => {
  const p = calendarPayload([
    { title: 'Federal Funds Rate', country: 'USD', date: '2026-10-28T14:00:00-04:00', impact: 'High', forecast: '3.75%', previous: '4.00%' },
    { title: 'MPC Official Bank Rate Votes', country: 'GBP', date: '2026-10-08T07:00:00-04:00', impact: 'High', actual: '0-2-7', previous: '0-1-8' },
    { title: 'Official Bank Rate', country: 'GBP', date: '2026-10-08T07:00:00-04:00', impact: 'High', actual: '3.75%', forecast: '3.75%', previous: '4.00%' },
    { title: 'Main Refinancing Rate', country: 'EUR', date: '2026-10-29T08:15:00-04:00', impact: 'High', previous: '2.15%' },
    { title: 'Deposit Facility Rate', country: 'EUR', date: '2026-10-29T08:15:00-04:00', impact: 'High', previous: '2.00%' },
  ], NOW);
  const r = Object.fromEntries(p.rates.map((x) => [x.bank as string, x]));
  assert.equal(r['Federal Reserve'].rate, '4.00%');
  assert.equal(r['Federal Reserve'].next_meeting, '2026-10-28');
  assert.equal(r['Bank of England'].rate, '3.75%');
  assert.equal(r['Bank of England'].last_change, 'Cut 0.25%');
  assert.equal(r['European Central Bank'].rate, '2.00%');
});

const RSS = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items}</channel></rss>`;
const item = (title: string, desc: string, date = 'Mon, 12 Oct 2026 09:00:00 GMT', link = 'https://example.com/' + encodeURIComponent(title)) =>
  `<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate><description><![CDATA[<p>${desc}</p>]]></description></item>`;

test('news: parses RSS, keeps two sentences, filters old, Nigeria and empty items', async () => {
  const xml = RSS(
    item('Oil jumps as tankers are attacked in the Red Sea', 'Brent rose 3% on Monday. Shipping firms rerouted vessels. More details inside.') +
    item('Bitcoin climbs past a new level', 'Crypto markets rallied as ETF inflows grew.') +
    item('Naira steadies in Lagos', 'The Nigeria central bank intervened.') +
    item('Old story', 'Something happened.', 'Mon, 05 Oct 2026 09:00:00 GMT') +
    item('No body', ''),
  );
  const out = await newsFromRss('CNBC', xml, NOW);
  assert.deepEqual(out.map((n) => n.title), ['Oil jumps as tankers are attacked in the Red Sea', 'Bitcoin climbs past a new level']);
  assert.equal(out[0].category, 'Geopolitics');
  assert.equal(out[0].tag, 'Middle East');
  assert.equal(out[0].body, 'Brent rose 3% on Monday. Shipping firms rerouted vessels.');
  assert.equal(out[1].category, 'Crypto');
  assert.equal(out[0].published_at, '2026-10-12T09:00:00.000Z');
  assert.match(String(out[0].id), /^n-[0-9a-f]{24}$/);
});

test('news: geopolitics-only feeds drop other stories; categories', async () => {
  const xml = RSS(item('Election results announced in Germany', 'Voters chose a new parliament.') + item('Football final tonight', 'The match starts at eight.'));
  const out = await newsFromRss('BBC News', xml, NOW, true);
  assert.deepEqual(out.map((n) => n.title), ['Election results announced in Germany']);
  assert.equal(categorize('Fed holds rates steady', 'Powell spoke')[0], 'Central banks');
  assert.equal(categorize('Gold hits record', 'Investors bought')[0], 'Commodities');
  assert.equal(categorize('Boeing deliveries rise', 'Jets')[0], 'Economy');
  assert.equal(categorize('Company wins award', 'warns of costs')[0], 'Economy');
});
