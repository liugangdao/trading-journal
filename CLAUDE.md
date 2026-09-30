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

Full-stack multi-user trading journal for forex/commodities. React 19 SPA served by Express 5 with SQLite (better-sqlite3).

- **Client**: React 19 + Vite 7 + Tailwind CSS v4 + Recharts
- **Server**: Express 5 + better-sqlite3 (WAL mode, foreign keys)
- **Auth**: Session-based (express-session + bcryptjs) with SQLite session store. Cookie: `connect.sid`, 30-day expiry
- **DB**: SQLite at `./data/journal.db` — 轻量交易字段增量保存在 `trades`；截图保存在 `trade_images`，周目标保存在 `weekly_goals`。旧复盘与政策表保留兼容历史数据。
- **Hyperliquid**: `server/hyperliquid/` 通过公开 `info` 接口同步主网默认永续仓位与成交；绑定、游标和去重表在 SQLite。`trades.source` 区分自动与手工记录；自动字段由同步维护，复盘字段仍由用户编辑。页面打开期间约每 30 秒轮询，断线后按游标补齐。
- **Build**: Vite outputs to `server/public`; Express serves static files with SPA fallback
- **Dev proxy**: Vite proxies `/api/*` → `http://localhost:3001`
- **Deploy**: Docker multi-stage build; Fly.io (region: nrt, volume mounted at `/app/data`)

### Environment Variables

- `PORT` — server port (default: `3001`)
- `NODE_ENV` — controls CORS origin behavior
- `SESSION_SECRET` — session signing key (default in code, override in production)

## API Routes

All under `/api` prefix (defined in `server/routes/`). Auth routes are public; all others require session via `server/middleware/requireAuth.js`.

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/auth` | register, login, logout, me, claim-data, orphan-count | Public — no auth required |
| `/api/trades` | GET, POST, PUT/:id, DELETE/:id | Sorting via `?sort=&order=` |
| `/api/journal` | GET by month, POST, PUT/:id, DELETE/:id, image endpoints, weekly goals | 轻量交易、截图和周目标；均需登录 |
| `/api/hyperliquid` | GET, PUT, DELETE, POST /sync | 一个当前用户的公开地址绑定、状态及只读同步 |
| `/api/notes` | GET, POST, DELETE/:id | Weekly notes (week field: `YYYY-Www`) |
| `/api/monthly-notes` | GET, POST, DELETE/:id | Monthly notes (month field: `YYYY-MM`) |
| `/api/pairs` | GET, POST, PUT/:id, DELETE/:id | 用户品种名称管理；历史点差字段仅作兼容保留 |
| `/api/policies` | GET, POST, PUT/:id, DELETE/:id, PUT/:id/toggle | Policy CRUD + toggle active |
| `/api/trades/:id/violations` | GET, PUT | Trade violation records (policy_ids array) |
| `/api/violations/stats` | GET | Violation statistics |
| `/api/export` | GET | JSON download of all data |
| `/api/import` | POST | Batch import trades/notes |

Trades have `status`: `open` or `closed`. Closed trades require `exit_price` and `gross_pnl`. All data queries are scoped to `req.session.userId`.

## Frontend Patterns

- **State**: `App.jsx` 管理登录、当前月份交易、品种、周目标、记录/日历/设置导航和表单状态。无 Redux/Zustand。
- **Auth flow**: `App.jsx` checks session on mount via `api.getMe()`. Global 401 handler triggers logout. `AuthPage.jsx` handles login/register toggle. `LandingPage.jsx` shown to unauthenticated visitors.
- **API client**: `client/src/hooks/useApi.js` — fetch wrapper with `credentials: 'include'` for session cookies, global 401 interception
- **Calculations**: `client/src/lib/calc.js` 保留旧交易的 R、美元盈亏和按日累计美元曲线；`client/src/lib/rStats.js` 汇总全部有效 R 记录，计算胜率、平均盈利/亏损 R、期望值、违规率与期望日曲线。
- **Constants**: `client/src/lib/constants.js` — strategies, emotions, scores, timeframes (pairs now come from DB per-user)
- **Tabs**: record、history、calendar、stats、settings。旧交易记录与美元统计保留，history 提供图片在上、说明在下的逐笔复盘及页内编辑；统计移除连胜、策略分析和周期分析。旧复盘、政策和 TradingView 入口已移除，旧表与接口仍保留。
- **Trade form**: 时间/品种、方向、市场环境、Setup、入场理由、失效条件、退出原因、最终 R 和/或美元盈亏、可多选执行标签；提前或手动平仓需写原因，结束后另答遮住盈亏是否为好交易。旧 `risk_plan` 和 `score` 保留兼容历史记录；图片通过独立登录接口读取。
- **Hyperliquid form**: 自动记录锁定时间、品种、方向和美元盈亏；同一表单只保存手工复盘字段。`JournalCard` 和 `ReviewOverlay` 显示来源、持仓数量与已观察手续费。
- **Theme**: Dark by default with light mode toggle (`client/src/hooks/useTheme.js`)
- **UI components**: `client/src/components/ui/` — Input, Select, Tab, KpiCard

## Key Conventions

- **Language**: All UI text is Chinese (zh-CN)
- **Styling**: Tailwind v4 CSS-based dark theme — custom tokens: `bg-card`, `bg-input`, `bg-header-bg`, `text-text`, `text-muted`, `border-border`, `accent` (blue). Fonts: Inter, JetBrains Mono
- **No TypeScript** — plain JS with ES modules throughout
- **No test framework** configured
- **Direction values**: 多 (Buy), 空 (Sell)
- **Score values**: A–D (完美执行 through 严重违规)
- **Per-user data isolation**: All DB queries filter by `user_id`; new users get five default pairs and legacy policies via `seedUserData()` in `server/db.js`. 未修改的旧版 23 品种默认清单会收敛为五个，用户自定义清单与历史交易保留。

## Database Schema

Schema auto-created in `server/db.js` with migrations applied inline. Key tables:

**users**: `id`, `username` (unique), `email` (unique), `password` (bcrypt hash)

**trades**: `user_id`, `date`, `pair`, `direction`, `strategy`, `timeframe`, `lots`, `entry`, `stop`, `target`, `exit_price`, `gross_pnl`, `swap`, `score`, `emotion`, `notes`, `status` (open/closed)

**hyperliquid_accounts / hyperliquid_fills**: 按用户保存公开地址、同步游标、错误状态和唯一成交 ID。自动交易的 `source_ref` 唯一；`source_realized_pnl`、`source_fee_usd` 支持恢复美元计算。同步美元值为已观察 `closedPnl` 减已观察手续费，未含资金费。超出官方历史窗口或仓位不一致时停止更新并要求人工核对。

**pairs**: `user_id`, `name`, `spread_cost`（旧字段，仅兼容）, `sort_order` — 按用户管理品种名称；页面不显示点差成本

**policies**: `user_id`, `category`, `title`, `content`, `sort_order`, `is_active`

**trade_violations**: `trade_id` (FK), `policy_id` (FK), `notes` — M:N link between trades and policies
