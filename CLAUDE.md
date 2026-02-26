# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
npm run install:all    # Install root + client + server deps
npm run dev            # Run client (:3000) + server (:3001) concurrently
npm run dev:client     # Client only
npm run dev:server     # Server only (node --watch)
npm run build          # Vite build → server/public
npm run start          # Production server only
node server/seed.js    # Populate sample data
docker compose up -d   # Docker deployment (port 3001)
```

## Architecture

Full-stack trading journal for forex/commodities. React 19 SPA served by Express 5 with SQLite (better-sqlite3).

- **Client**: React 19 + Vite 7 + Tailwind CSS v4 + Recharts
- **Server**: Express 5 + better-sqlite3 (WAL mode, foreign keys)
- **DB**: SQLite at `./data/journal.db` — 3 tables: `trades`, `weekly_notes`, `monthly_notes`
- **Build**: Vite outputs to `server/public`; Express serves static files with SPA fallback
- **Dev proxy**: Vite proxies `/api/*` → `http://localhost:3001`

## API Routes

All under `/api` prefix (defined in `server/routes/`):

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/trades` | GET, POST, PUT/:id, DELETE/:id | Sorting via `?sort=&order=` |
| `/api/notes` | GET, POST, DELETE/:id | Weekly notes (week field: `YYYY-Www`) |
| `/api/monthly-notes` | GET, POST, DELETE/:id | Monthly notes (month field: `YYYY-MM`) |
| `/api/export` | GET | JSON download of all data |

Trades have `status`: `open` or `closed`. Closed trades require `exit_price` and `gross_pnl`.

## Frontend Patterns

- **State**: All in `App.jsx` — trades, notes, monthlyNotes, tab navigation, form state
- **API client**: `client/src/hooks/useApi.js` — fetch wrapper returning `api` object
- **Calculations**: `client/src/lib/calc.js` — `calcTrade()` (R-multiple, pips, spread, net P&L) and `calcStats()` (aggregated stats, breakdowns by pair/strategy/emotion/day/timeframe)
- **Constants**: `client/src/lib/constants.js` — pairs, strategies, emotions, scores, spread costs, timeframes
- **Tabs**: record (trade form + table + open positions), stats (dashboard), weekly, monthly
- **Trade form modes**: open (new position), close (fill exit fields), edit (modify closed trade)
- **UI components**: `client/src/components/ui/` — Input, Select, Tab, KpiCard

## Key Conventions

- **Language**: All UI text is Chinese (zh-CN)
- **Styling**: Tailwind v4 CSS-based dark theme — custom tokens: `bg-card`, `text-text`, `text-muted`, `border-border`, `accent` (blue). Fonts: Inter, JetBrains Mono
- **No TypeScript** — plain JS with ES modules throughout
- **No test framework** configured
- **Direction values**: 多 (Buy), 空 (Sell)
- **Score values**: A–D (完美执行 through 严重违规)

## Database Schema

Schema auto-created in `server/db.js`. Key fields on `trades`:
- `pair`, `direction`, `strategy`, `timeframe`, `entry`, `stop` — always required
- `exit_price`, `gross_pnl` — required when closing
- `lots`, `target`, `swap`, `score`, `emotion`, `notes` — optional
- `status` — `open` or `closed` (default: `closed`)
