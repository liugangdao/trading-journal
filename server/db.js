import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const db = new Database(join(dataDir, 'journal.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL,
    strategy TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    lots REAL,
    entry REAL NOT NULL,
    stop REAL NOT NULL,
    target REAL,
    exit_price REAL,
    gross_pnl REAL,
    swap REAL DEFAULT 0,
    score TEXT,
    emotion TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'closed',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week TEXT NOT NULL,
    lesson TEXT,
    plan TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS monthly_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    lesson TEXT,
    plan TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    spread_cost REAL DEFAULT 5,
    sort_order INTEGER DEFAULT 0
  );
`)

// Seed pairs table if empty
const pairCount = db.prepare('SELECT COUNT(*) as cnt FROM pairs').get().cnt
if (pairCount === 0) {
  const defaultPairs = {
    "EUR/USD": 3.5, "GBP/USD": 4, "USD/JPY": 3, "AUD/USD": 3.5,
    "NZD/USD": 4.5, "USD/CAD": 4, "USD/CHF": 4, "EUR/GBP": 4.5,
    "EUR/JPY": 5, "GBP/JPY": 6, "AUD/JPY": 5, "NZD/JPY": 5,
    "CAD/JPY": 5, "AUD/CAD": 4, "EUR/AUD": 5, "USD/CNH": 8,
    "XAU/USD": 12, "XAG/USD": 10, "USOil": 5, "UKOil": 6,
    "NGAS": 8, "Copper": 5, "BABA.hk": 1
  }
  const insert = db.prepare('INSERT INTO pairs (name, spread_cost, sort_order) VALUES (?, ?, ?)')
  const seedPairs = db.transaction(() => {
    Object.entries(defaultPairs).forEach(([name, cost], i) => {
      insert.run(name, cost, i)
    })
  })
  seedPairs()
}

// Migration: add status column if missing (SQLite cannot ALTER COLUMN, so recreate table)
const columns = db.prepare("PRAGMA table_info(trades)").all()
const hasStatus = columns.some(c => c.name === 'status')
if (!hasStatus) {
  db.exec(`
    ALTER TABLE trades RENAME TO trades_old;
    CREATE TABLE trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      pair TEXT NOT NULL,
      direction TEXT NOT NULL,
      strategy TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      lots REAL,
      entry REAL NOT NULL,
      stop REAL NOT NULL,
      target REAL,
      exit_price REAL,
      gross_pnl REAL,
      swap REAL DEFAULT 0,
      score TEXT,
      emotion TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'closed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO trades (id, date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, created_at, updated_at)
      SELECT id, date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, 'closed', created_at, updated_at FROM trades_old;
    DROP TABLE trades_old;
  `)
}

export default db
