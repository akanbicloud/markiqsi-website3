import { neon } from '@neondatabase/serverless';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Sql = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>) & {
  query: (text: string, params?: unknown[]) => Promise<Row[]>;
};

let _sql: Sql | null = null;

export function hasDb() {
  return !!process.env.DATABASE_URL;
}

/** Neon over HTTP in production. Set DB_DRIVER=pg to use a normal Postgres server instead (local testing or self-hosting). */
export function sql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (_sql) return _sql;
  if (process.env.DB_DRIVER === 'pg') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg') as typeof import('pg');
    const pool = new Pool({ connectionString: url, max: 5 });
    const run = async (text: string, params: unknown[] = []) => (await pool.query(text, params as unknown[])).rows as Row[];
    const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = strings[0];
      for (let i = 1; i < strings.length; i++) text += `$${i}` + strings[i];
      return run(text, values);
    }) as Sql;
    tag.query = run;
    _sql = tag;
  } else {
    const n = neon(url);
    const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => n(strings, ...values) as Promise<Row[]>) as Sql;
    tag.query = (text: string, params: unknown[] = []) => n.query(text, params) as Promise<Row[]>;
    _sql = tag;
  }
  return _sql;
}

let ready: Promise<void> | null = null;

/** Creates every table the website needs, once per server start. Safe to run many times. */
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const q = sql();
      for (const stmt of SCHEMA) await q.query(stmt);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export async function db() {
  await ensureSchema();
  return sql();
}

const SCHEMA = [
  // ---------- Website tables (the website writes these) ----------
  `CREATE TABLE IF NOT EXISTS mq_users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    goal TEXT,
    level TEXT,
    markets TEXT[] DEFAULT '{}',
    onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id TEXT,
    telegram_username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS mq_login_tokens (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS mq_login_tokens_email ON mq_login_tokens(email, created_at)`,
  `CREATE TABLE IF NOT EXISTS mq_telegram_links (
    code TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES mq_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS mq_journal (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES mq_users(id) ON DELETE CASCADE,
    trade_date DATE NOT NULL,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    lots NUMERIC,
    entry NUMERIC,
    exit NUMERIC,
    pnl NUMERIC NOT NULL DEFAULT 0,
    setup TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS mq_journal_user ON mq_journal(user_id, trade_date)`,
  `CREATE TABLE IF NOT EXISTS mq_bots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES mq_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mq_scan_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES mq_users(id) ON DELETE CASCADE,
    markets TEXT[] NOT NULL,
    timeframes TEXT[] NOT NULL,
    strategies TEXT[] NOT NULL,
    bot_id BIGINT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mq_scan_sent (
    user_id BIGINT NOT NULL,
    setup_key TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, setup_key)
  )`,
  `CREATE TABLE IF NOT EXISTS mq_event_reminders (
    user_id BIGINT NOT NULL REFERENCES mq_users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, event_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mq_ask_usage (
    who TEXT NOT NULL,
    day DATE NOT NULL,
    count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (who, day)
  )`,
  `CREATE TABLE IF NOT EXISTS mq_price_cache (
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    candles JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT,
    PRIMARY KEY (symbol, timeframe)
  )`,
  `CREATE TABLE IF NOT EXISTS mq_scan_results (
    setup_key TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    strategy TEXT NOT NULL,
    direction TEXT NOT NULL,
    strength INT NOT NULL,
    detail TEXT NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    found_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ---------- Market data tables (the MARKET BOT writes these, the website reads them) ----------
  `CREATE TABLE IF NOT EXISTS mi_events (
    id TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    currency TEXT NOT NULL,
    name TEXT NOT NULL,
    impact TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    what TEXT,
    why TEXT,
    markets TEXT[] DEFAULT '{}',
    forecast TEXT,
    previous TEXT,
    source TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS mi_events_time ON mi_events(scheduled_at)`,
  `CREATE TABLE IF NOT EXISTS mi_results (
    event_id TEXT PRIMARY KEY,
    country TEXT NOT NULL,
    name TEXT NOT NULL,
    actual TEXT NOT NULL,
    forecast TEXT,
    previous TEXT,
    verdict TEXT,
    surprise_score INT,
    simply TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    released_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mi_news (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    tag TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    reaction TEXT,
    source TEXT,
    source_url TEXT,
    published_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mi_rates (
    bank TEXT PRIMARY KEY,
    currency TEXT NOT NULL,
    rate TEXT NOT NULL,
    last_change TEXT,
    last_change_date DATE,
    next_meeting DATE,
    source_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mi_reactions (
    id BIGSERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    country TEXT,
    released_at TIMESTAMPTZ NOT NULL,
    surprise TEXT,
    asset TEXT NOT NULL,
    move_1h TEXT,
    move_1d TEXT,
    note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS mi_live (
    id INT PRIMARY KEY DEFAULT 1,
    is_live BOOLEAN NOT NULL DEFAULT FALSE,
    title TEXT,
    youtube_id TEXT,
    summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];
