# MarkIQ SI website

Market Intelligence & Academy. Next.js 16 · Neon (Postgres) · Resend (login emails) · Gemini (Ask MarkIQ) · Twelve Data (scanner prices) · TradingView charts.

## What is in it
- **Pages:** Home, Markets, Tools, About, FAQs, Terms, Privacy, Log in / Get Started, Welcome (setup questions), My account.
- **Accounts:** email login links (no passwords), then 3 setup questions, Telegram connect.
- **Markets:** this week's events, central bank rates, latest results, live broadcasts, news (incl. geopolitics), Ask MarkIQ. All data comes from the market bot through the shared database. See `docs/BOT_INTEGRATION.md`.
- **Tools:** Risk Calculator, Prop Challenge Tracker, Market Scanner (18 strategies incl. supply & demand, candle patterns, FVG, order blocks, BOS/CHoCH, liquidity sweeps, OTE, London breakout, trend pullback, Bollinger, Stochastic, Supertrend; 1 minute to monthly; higher-timeframe confirmation), Charts (20+ years of history, bar replay with practice trades, plus the live TradingView chart), Bot Builder (19 entry types + confirmation, 200 EMA trend filter and session filter → MQL5 + Pine Script, backtest, save, 9 ready-made strategies), Trading Journal.
- Dark mode, back-to-top button, mobile layout.

## Go live (one time)
1. **Neon:** create a project → copy the *pooled* connection string.
2. **Resend:** add the domain `markiqsi.com` (Resend shows DNS records to add in Namecheap) → create an API key.
3. **Twelve Data:** create a free account → copy the API key.
4. **Gemini:** Google AI Studio → create an API key (you already have one for the bot; a separate one is better).
5. **Vercel:** New Project → import this GitHub repository → add every variable from `.env.example` → Deploy.
6. **Domain:** Vercel → Project → Domains → add `markiqsi.com` → add the DNS records it shows in Namecheap.
7. Give `docs/BOT_INTEGRATION.md` to Antigravity for the market bot.

The database tables are created automatically on the first visit.

## Run on a computer
```
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```
`npm test` runs the trading engine tests (18 tests, including a check that no strategy ever looks at future candles). `npm run typecheck` checks types.

## Add photos
The "What Makes MarkIQ SI Different" cards use the illustrations `public/images/different-1.svg` to `different-3.svg`. To use photos instead, add them to `public/images/` and change the `img` paths in `src/app/(site)/page.tsx`.

## Social links
Edit `src/lib/site.ts` to add the Facebook link. Set `NEXT_PUBLIC_TELEGRAM_URL` in Vercel for the Telegram channel link.

## Price data and the free plan
The free Twelve Data plan allows 8 requests a minute and 800 a day. The website counts every request and never goes over.
- 1H, 4H, daily, weekly and monthly scans refresh automatically for all markets.
- 1m, 5m, 15m and 30m scans refresh when someone scans them, and for markets with a Telegram alert on them.
- Chart history is downloaded once (5,000 candles at a time) and kept, so 20 years of daily data costs about 2 requests.
On a paid plan, raise `TWELVE_DATA_PER_MINUTE` / `TWELVE_DATA_PER_DAY` and set `SCANNER_FAST=on`.
Second-by-second charts are not possible with this data source.
