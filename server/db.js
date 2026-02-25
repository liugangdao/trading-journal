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
`)

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
