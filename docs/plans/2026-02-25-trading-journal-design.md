# Trading Journal Web App - Design Document

Date: 2026-02-25

## Overview

Full-stack trading journal for forex/commodities/energy trading review. Converts existing single-file React component into a proper Vite + Express + SQLite application with Apple-style dark UI.

## Requirements

- CRUD for trade records with auto-calculated metrics (R-multiple, spread cost, net PnL)
- Statistics dashboard with charts (cumulative PnL, pair/strategy/emotion breakdowns)
- Weekly review notes
- Data persistence via SQLite
- JSON data export
- Server deployment via Docker

## Architecture

**Stack**: React 18 + Vite + Tailwind CSS + recharts (frontend), Express.js + better-sqlite3 (backend), SQLite (database)

**Deployment**: Single Docker container, Express serves both API and frontend static build.

## Project Structure

```
trading-journal/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── TradeForm.jsx
│   │   │   ├── TradeTable.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── WeeklyNotes.jsx
│   │   │   └── ui/
│   │   │       ├── Input.jsx
│   │   │       ├── Select.jsx
│   │   │       ├── Tab.jsx
│   │   │       └── KpiCard.jsx
│   │   ├── hooks/
│   │   │   └── useApi.js
│   │   ├── lib/
│   │   │   ├── calc.js
│   │   │   └── constants.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/
│   ├── index.js
│   ├── db.js
│   └── routes/
│       ├── trades.js
│       └── notes.js
├── data/
│   └── journal.db (gitignored)
├── package.json
├── Dockerfile
└── .gitignore
```

## Database Schema

```sql
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
  exit_price REAL NOT NULL,
  gross_pnl REAL NOT NULL,
  swap REAL DEFAULT 0,
  score TEXT,
  emotion TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE weekly_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week TEXT NOT NULL,
  lesson TEXT,
  plan TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trades` | List all trades (supports ?sort, ?order) |
| POST | `/api/trades` | Create trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade |
| GET | `/api/notes` | List all weekly notes |
| POST | `/api/notes` | Create weekly note |
| DELETE | `/api/notes/:id` | Delete weekly note |
| GET | `/api/export` | Export all data as JSON download |

Calculation logic (R-multiple, net PnL, spread cost) stays in the frontend, consistent with the existing code. API only handles data storage and retrieval.

## UI Design

**Theme**: Dark mode, Apple-style minimalism
- Background: #0a0e17, Cards: #111827, Borders: #1e293b
- Accent: #3b82f6, Green: #10b981, Red: #ef4444

**Style approach**: Tailwind CSS with custom dark theme palette

**Design principles**:
- Generous whitespace and card spacing
- Fonts: Inter/SF Pro for UI, JetBrains Mono for numbers
- Subtle hover/transition animations
- Frosted glass effect (backdrop-blur) for header
- Apple segment-control style tab navigation
- Slide-in animation for trade form
- Soft hover highlights on table rows
- Subtle gradient borders on KPI cards

**Components** (extracted from existing single-file):
1. Layout - Fixed header + content area
2. TradeForm - Trade entry/edit form with auto-calc preview
3. TradeTable - Trade list with edit/delete actions
4. Dashboard - KPI row + charts + detail tables
5. WeeklyNotes - Review notes CRUD
6. ui/ - Reusable Input, Select, Tab, KpiCard components

## Constants (preserved from original)

- PAIRS: 16 instruments (EUR/USD, GBP/USD, XAU/USD, USOil, etc.)
- DIRECTIONS: Buy/Sell
- STRATEGIES: 8 types
- TIMEFRAMES: M15 to W1
- SCORES: A-D execution grades
- EMOTIONS: 7 emotional states
- SPREAD_COST: Per-pair spread in USD per lot

## Data Export

GET `/api/export` returns:
```json
{
  "exportDate": "2026-02-25T12:00:00Z",
  "trades": [...],
  "weeklyNotes": [...]
}
```
Browser triggers download as `trading-journal-YYYY-MM-DD.json`.
