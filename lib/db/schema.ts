export const SCHEMA_VERSION = 1

export const CREATE_TABLES = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App configuration key-value store
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- WATCHLISTS
-- ==========================================
CREATE TABLE IF NOT EXISTS watchlists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist_symbols (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  exchange     TEXT NOT NULL DEFAULT 'NSE',
  token        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(watchlist_id, symbol, exchange)
);

-- ==========================================
-- PAPER TRADING
-- ==========================================
CREATE TABLE IF NOT EXISTS paper_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL DEFAULT 'Default',
  initial_balance REAL NOT NULL DEFAULT 1000000.0,
  current_balance REAL NOT NULL DEFAULT 1000000.0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES paper_accounts(id),
  symbol           TEXT NOT NULL,
  exchange         TEXT NOT NULL DEFAULT 'NSE',
  segment          TEXT NOT NULL CHECK(segment IN ('EQ','FO','CDS')),
  order_type       TEXT NOT NULL CHECK(order_type IN ('MARKET','LIMIT','SL','SL-M')),
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY','SELL')),
  product_type     TEXT NOT NULL CHECK(product_type IN ('CNC','MIS','NRML')),
  quantity         INTEGER NOT NULL,
  price            REAL,
  trigger_price    REAL,
  status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','OPEN','EXECUTED','CANCELLED','REJECTED')),
  filled_price     REAL,
  filled_quantity  INTEGER DEFAULT 0,
  filled_at        TEXT,
  option_type      TEXT CHECK(option_type IN ('CE','PE',NULL)),
  strike_price     REAL,
  expiry_date      TEXT,
  strategy_id      INTEGER REFERENCES strategies(id),
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES paper_accounts(id),
  symbol        TEXT NOT NULL,
  exchange      TEXT NOT NULL DEFAULT 'NSE',
  segment       TEXT NOT NULL,
  quantity      INTEGER NOT NULL,
  average_price REAL NOT NULL,
  current_price REAL,
  product_type  TEXT NOT NULL,
  option_type   TEXT,
  strike_price  REAL,
  expiry_date   TEXT,
  realized_pnl  REAL NOT NULL DEFAULT 0.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, symbol, exchange, segment, product_type,
         option_type, strike_price, expiry_date)
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id       INTEGER NOT NULL REFERENCES paper_accounts(id),
  order_id         INTEGER NOT NULL REFERENCES paper_orders(id),
  symbol           TEXT NOT NULL,
  exchange         TEXT NOT NULL,
  segment          TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  price            REAL NOT NULL,
  option_type      TEXT,
  strike_price     REAL,
  expiry_date      TEXT,
  pnl              REAL,
  executed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- STRATEGIES
-- ==========================================
CREATE TABLE IF NOT EXISTS strategy_templates (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  description        TEXT,
  legs_json          TEXT NOT NULL,
  max_profit         TEXT,
  max_loss           TEXT,
  breakeven_formula  TEXT,
  is_builtin         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS strategies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id      INTEGER REFERENCES strategy_templates(id),
  name             TEXT NOT NULL,
  underlying       TEXT NOT NULL,
  expiry_date      TEXT NOT NULL,
  legs_json        TEXT NOT NULL,
  target_pnl       REAL,
  stop_loss_pnl    REAL,
  status           TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','PAPER','LIVE','CLOSED')),
  paper_account_id INTEGER REFERENCES paper_accounts(id),
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- ALERTS
-- ==========================================
CREATE TABLE IF NOT EXISTS alerts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol         TEXT NOT NULL,
  exchange       TEXT NOT NULL DEFAULT 'NSE',
  alert_type     TEXT NOT NULL
    CHECK(alert_type IN ('PRICE_ABOVE','PRICE_BELOW','PATTERN','INDICATOR','VOLUME','OI_CHANGE')),
  condition_json TEXT NOT NULL,
  is_active      INTEGER NOT NULL DEFAULT 1,
  triggered_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- NEWS CACHE
-- ==========================================
CREATE TABLE IF NOT EXISTS news_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  title                 TEXT NOT NULL,
  url                   TEXT NOT NULL UNIQUE,
  source                TEXT NOT NULL,
  summary               TEXT,
  published_at          TEXT NOT NULL,
  fetched_at            TEXT NOT NULL DEFAULT (datetime('now')),
  sentiment             TEXT CHECK(sentiment IN ('positive','negative','neutral',NULL)),
  affected_symbols_json TEXT,
  is_read               INTEGER NOT NULL DEFAULT 0
);

-- ==========================================
-- CONSOLE LOGS
-- ==========================================
CREATE TABLE IF NOT EXISTS console_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  level         TEXT NOT NULL CHECK(level IN ('info','warn','error','trade','signal','system')),
  source        TEXT NOT NULL,
  message       TEXT NOT NULL,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- INSTRUMENT MASTER
-- ==========================================
CREATE TABLE IF NOT EXISTS instrument_master (
  token           TEXT PRIMARY KEY,
  symbol          TEXT NOT NULL,
  name            TEXT NOT NULL,
  exchange        TEXT NOT NULL,
  segment         TEXT NOT NULL,
  instrument_type TEXT,
  option_type     TEXT,
  strike_price    REAL,
  expiry_date     TEXT,
  lot_size        INTEGER DEFAULT 1,
  tick_size       REAL DEFAULT 0.05,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================
-- REPORTS
-- ==========================================
CREATE TABLE IF NOT EXISTS reports (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id        INTEGER NOT NULL REFERENCES paper_accounts(id),
  report_date       TEXT NOT NULL,
  open_value        REAL NOT NULL DEFAULT 0,
  closed_value      REAL NOT NULL DEFAULT 0,
  realized_pnl      REAL NOT NULL DEFAULT 0,
  unrealized_pnl    REAL NOT NULL DEFAULT 0,
  total_pnl         REAL NOT NULL DEFAULT 0,
  total_return      REAL NOT NULL DEFAULT 0,
  trades_executed   INTEGER NOT NULL DEFAULT 0,
  win_rate          REAL NOT NULL DEFAULT 0,
  avg_win           REAL NOT NULL DEFAULT 0,
  avg_loss          REAL NOT NULL DEFAULT 0,
  profit_factor     REAL NOT NULL DEFAULT 0,
  top_gainers_json  TEXT,
  top_losers_json   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, report_date)
);

CREATE TABLE IF NOT EXISTS report_subscriptions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id        INTEGER NOT NULL REFERENCES paper_accounts(id),
  email             TEXT NOT NULL,
  frequency         TEXT NOT NULL DEFAULT 'daily' CHECK(frequency IN ('daily','weekly')),
  enable_email      INTEGER NOT NULL DEFAULT 1,
  last_sent_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, email)
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_instrument_symbol  ON instrument_master(symbol);
CREATE INDEX IF NOT EXISTS idx_instrument_expiry  ON instrument_master(expiry_date);
CREATE INDEX IF NOT EXISTS idx_paper_orders_acct  ON paper_orders(account_id, status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_acct  ON paper_trades(account_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_news_published     ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_console_created    ON console_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_active      ON alerts(is_active, symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_sym      ON watchlist_symbols(watchlist_id, symbol);
CREATE INDEX IF NOT EXISTS idx_reports_date      ON reports(account_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_report_subs       ON report_subscriptions(account_id, enable_email);
`

export const SEED_DATA = `
-- Default watchlist
INSERT OR IGNORE INTO watchlists (name) VALUES ('My Watchlist');

-- Seed default Nifty50 symbols into watchlist 1
INSERT OR IGNORE INTO watchlist_symbols (watchlist_id, symbol, exchange) VALUES
  (1,'RELIANCE','NSE'),(1,'TCS','NSE'),(1,'HDFCBANK','NSE'),
  (1,'INFOSYS','NSE'),(1,'ICICIBANK','NSE'),(1,'WIPRO','NSE'),
  (1,'AXISBANK','NSE'),(1,'TATAMOTORS','NSE'),(1,'SBIN','NSE'),
  (1,'LT','NSE');

-- Default paper trading account
INSERT OR IGNORE INTO paper_accounts (id, name, initial_balance, current_balance)
VALUES (1, 'Primary Account', 1000000, 1000000);
`
