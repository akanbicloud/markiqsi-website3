# MarkIQ SI website

Market Intelligence & Academy. Next.js 16 · Neon (Postgres) · Resend (login emails) · Gemini (Ask MarkIQ) · Twelve Data (scanner prices) · TradingView charts.

## What is in it
- **Pages:** Home, Markets, Tools, About, FAQs, Terms, Privacy, Log in / Get Started, Welcome (setup questions), My account.
- **Accounts:** email login links (no passwords), then 3 setup questions, Telegram connect.
- **Markets:** this week's events, central bank rates, latest results, live broadcasts, news (incl. geopolitics), Ask MarkIQ. All data comes from the market bot through the shared database. See `docs/BOT_INTEGRATION.md`.
- **Tools:** Risk Calculator, Prop Challenge Tracker, Market Scanner (12 strategies incl. supply & demand, candle patterns, FVG, order blocks, BOS/CHoCH, liquidity sweeps, OTE), Charts, Bot Builder (plain words → MQL5 + Pine Script, backtest, save), Trading Journal.
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
`npm test` runs the trading engine tests. `npm run typecheck` checks types.

## Add photos
Put three photos in `public/images/` named `different-1.jpg`, `different-2.jpg`, `different-3.jpg` (the "What Makes MarkIQ SI Different" cards). Until then a coloured background shows.

## Social links
Edit `src/lib/site.ts` to add the Facebook link. Set `NEXT_PUBLIC_TELEGRAM_URL` in Vercel for the Telegram channel link.
