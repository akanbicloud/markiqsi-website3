# MarkIQ SI market bot ↔ website: what the bot must do

Give this whole file to Antigravity. The website is finished. The market bot only needs these 4 small jobs.
The website and the bot share ONE Neon database (same `DATABASE_URL`). The website creates all tables
automatically the first time it runs, so the bot only inserts/updates rows.

Rules that still apply: never invent data, every number must come from an official source, keep keys in `.env`
only, never log secrets.

---

## Job 1 — Write market data into these tables

All times are stored in UTC (`TIMESTAMPTZ`). Use `INSERT ... ON CONFLICT (...) DO UPDATE` so re-running is safe.

### `mi_events` — upcoming calendar (next 8 days)
| column | type | example |
|---|---|---|
| id | TEXT primary key, stable per event | `us-cpi-2026-10-15` |
| country | TEXT | `US`, `UK`, `Eurozone`, `Japan`, `China`, `Canada`, `Australia`, `Global` |
| currency | TEXT | `USD` |
| name | TEXT | `US inflation (CPI)` |
| impact | TEXT | `High` or `Medium` (only store High and Medium) |
| scheduled_at | TIMESTAMPTZ | `2026-10-15T12:30:00Z` |
| what | TEXT, plain words | `How fast prices are rising in the US.` |
| why | TEXT, plain words | `The biggest number for the Fed. It moves the dollar, gold and stocks.` |
| markets | TEXT[] | `{Forex,Stocks,Commodities,Crypto}` (use only these 4 words) |
| forecast | TEXT or NULL | `3.1%` |
| previous | TEXT or NULL | `3.3%` |
| source | TEXT | `US Bureau of Labor Statistics` |

### `mi_results` — the moment a number is released
| column | example |
|---|---|
| event_id (TEXT primary key, same id as `mi_events`) | `us-cpi-2026-10-15` |
| country, name | `US`, `US inflation (CPI)` |
| actual, forecast, previous (TEXT) | `3.4%`, `3.1%`, `3.3%` |
| verdict (TEXT) | exactly one of: `Higher than expected`, `Lower than expected`, `As expected` |
| surprise_score (INT 0–10) | `7` |
| simply (TEXT, one plain sentence) | `Prices rose faster than expected, so the dollar got stronger.` |
| source (TEXT), source_url (TEXT) | `US Bureau of Labor Statistics`, `https://www.bls.gov/...` |
| released_at (TIMESTAMPTZ) | `2026-10-15T12:30:00Z` |

If the official number is not out yet, do NOT insert a row (the website shows nothing rather than a guess).

### `mi_rates` — central bank rates (update after each meeting, check daily)
`bank` (TEXT primary key, e.g. `Federal Reserve`), `currency` (`USD`), `rate` (`4.00%`), `last_change` (`Cut 0.25%`, `Raised 0.25%` or `Hold`),
`last_change_date` (DATE), `next_meeting` (DATE), `source_url`, `updated_at` (now()).
Banks: Federal Reserve, European Central Bank, Bank of England, Bank of Japan, Bank of Canada, Reserve Bank of Australia, People's Bank of China.
The scanner reads the number inside `rate`, so always write it like `4.00%`.

### `mi_news` — news in plain words (including geopolitics)
`id` (TEXT primary key), `category` (exactly one of `Geopolitics`, `Economy`, `Central banks`, `Commodities`, `Crypto`),
`tag` (short label, e.g. `Middle East`), `title`, `body` (2 plain sentences), `reaction` (how markets moved), `source`, `source_url`, `published_at`.
Keep the last 30 days.

### `mi_reactions` — history for Ask MarkIQ (optional but recommended)
One row per past release per asset: `event_name`, `country`, `released_at`, `surprise` (`Higher than expected` …),
`asset` (e.g. `EURUSD`, `XAUUSD`, `BTCUSD`, `SPX`), `move_1h` (e.g. `-0.45%`), `move_1d`, `note`.
Only from real stored price history.

### `mi_live` — live central bank broadcast (single row, id = 1)
When a Fed/ECB/BoE/BoJ press conference is live on YouTube: `is_live = true`, `title`, `youtube_id` (the video id), `summary` (update every few minutes in plain words). Set `is_live = false` when it ends.

---

## Job 2 — Link Telegram accounts (`/start` code)

On the website a user presses **Connect Telegram**. They are sent to `https://t.me/<BOT_USERNAME>?start=mq_XXXX`.
When the bot receives `/start mq_XXXX`:

```sql
UPDATE mq_users u SET telegram_chat_id = :chat_id, telegram_username = :username
FROM mq_telegram_links l
WHERE l.code = :code AND l.user_id = u.id AND l.used_at IS NULL AND l.expires_at > now()
RETURNING u.name;
UPDATE mq_telegram_links SET used_at = now() WHERE code = :code;
```
If a row came back, reply: `Connected! You will now get your MarkIQ SI alerts here.` Otherwise: `This link has expired. Please press Connect Telegram on markiqsi.com again.`

When the bot sends market alerts to users, send them to every `mq_users.telegram_chat_id` whose `markets` array overlaps the event's `markets` (map: `Forex`→Forex, `Gold & Oil`/`Indices`/`Stocks`→Commodities/Stocks, `Crypto`→Crypto). The public channel keeps working as now.

## Job 3 — Call the website scanner every 2 minutes

```
GET https://markiqsi.com/api/cron/scanner
Header: Authorization: Bearer <CRON_SECRET>
```
Use the same `CRON_SECRET` value as in Vercel. This one call refreshes prices, runs the Market Scanner, sends scanner
alerts and event reminders on Telegram. Log failures, do not crash the bot if the website is down.

## Job 4 — Do not send event reminders yourself
The website already sends the “Remind me on Telegram” reminders 15 minutes before each event (from `mq_event_reminders`).

## Tables the bot must NOT write
Everything starting with `mq_` belongs to the website, except the two Telegram updates in Job 2.
