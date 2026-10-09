# MarkIQ SI market bot ↔ website

The bot (repo `akanbicloud/markiq-ai`, file `services/website_sync.py`) talks to the website over HTTPS.
It never needs the database password. Every call sends `Authorization: Bearer <CRON_SECRET>`
(the same value as `CRON_SECRET` in Vercel).

| What | Endpoint | How often |
|---|---|---|
| Run the Market Scanner, scanner alerts and event reminders | `GET /api/cron/scanner` | every 2 minutes |
| Send calendar events, released results, central bank rates, news, live broadcast | `POST /api/bot/sync` | events/results/rates every 5 min, news every 15 min |
| Link a website account to Telegram (`/start mq_XXXX`) | `POST /api/bot/link` | when a user opens the bot from "Connect Telegram" |

## `POST /api/bot/sync` body (all parts optional)
```json
{
  "events":  [{ "id", "country", "currency", "name", "impact": "High|Medium", "scheduled_at": "ISO UTC",
                "what", "why", "markets": ["Forex","Stocks","Commodities","Crypto"], "forecast", "previous", "source" }],
  "results": [{ "event_id", "country", "name", "actual", "forecast", "previous",
                "verdict": "Higher than expected|Lower than expected|As expected", "surprise_score": 0-10,
                "simply", "source", "source_url", "released_at" }],
  "rates":   [{ "bank", "currency", "rate": "4.00%", "last_change", "last_change_date": "YYYY-MM-DD",
                "next_meeting": "YYYY-MM-DD", "source_url" }],
  "news":    [{ "id", "category": "Geopolitics|Economy|Central banks|Commodities|Crypto", "tag", "title",
                "body", "reaction", "source", "source_url", "published_at" }],
  "live":    { "is_live": true, "title", "youtube_id", "summary" }
}
```
Countries allowed: US, UK, Eurozone, Japan, China, Canada, Australia, Global (no Nigeria).
Banks allowed: Federal Reserve, European Central Bank, Bank of England, Bank of Japan, Bank of Canada,
Reserve Bank of Australia, People's Bank of China.
Rows that break these rules are skipped, never guessed. A result is only accepted with a real `actual` value.
Blank rate fields never erase what is stored. News older than 30 days and events older than 7 days are removed.

## `POST /api/bot/link` body
`{ "code": "mq_XXXX", "chat_id": 123456789, "username": "name" }` → `{ "ok": true, "linked": true|false, "name": "..." }`.
A code works once and expires 30 minutes after the user presses Connect Telegram.

## Rules
Never invent data. Keys only in `.env` / Vercel. Never log secrets. The website sends event reminders itself.
