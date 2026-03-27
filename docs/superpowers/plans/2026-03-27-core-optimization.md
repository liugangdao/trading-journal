# Core Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the trading journal with datetime precision (open_time/close_time), server-side filtering + pagination, enhanced statistics (weekly trends, streaks, cross-analysis), and R-multiple calculation fix.

**Architecture:** Database migration renames `date` → `open_time` and adds `close_time`. The trades API gains filtering/pagination params with dynamic SQL. Frontend splits into `pagedTrades` (filtered, for TradeTable) and `allTrades` (full, for Dashboard). New Dashboard sections: streak KPIs, weekly trend charts, collapsible cross-analysis tables with KPI comparison arrows.

**Tech Stack:** Express 5 + better-sqlite3, React 19 + Recharts, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-27-core-optimization-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `server/db.js` | Modify | Add migration: `date` → `open_time`, add `close_time` column |
| `server/routes/trades.js` | Modify | Filtering + pagination params, new response format, field rename |
| `server/index.js` | Modify | Export/import: `date` → `open_time` compat |
| `client/src/lib/calc.js` | Modify | R-multiple fix, streak/drawdown/weeklyTrend calculations, field rename |
| `client/src/hooks/useApi.js` | Modify | `getTrades(params)` with query string support |
| `client/src/App.jsx` | Modify | Split trades into pagedTrades/allTrades, add filter/pagination state |
| `client/src/components/TradeForm.jsx` | Modify | `date` → `open_time` datetime-local, add `close_time` field |
| `client/src/components/TradeTable.jsx` | Modify | Server-side pagination, display `MM/DD HH:mm` |
| `client/src/components/OpenPositions.jsx` | Modify | Display hold duration |
| `client/src/components/PsychologyPanel.jsx` | Modify | `t.date` → `t.open_time` |
| `client/src/components/ExportBar.jsx` | Modify | Field name update for export range |
| `client/src/components/Dashboard.jsx` | Modify | KPI comparison, trend charts, collapsible analysis, remove pie/bar charts |
| `client/src/components/ui/KpiCard.jsx` | Modify | Add `comparison` prop |
| `client/src/components/TradeFilter.jsx` | Create | Filter bar with quick buttons + dropdowns |
| `client/src/components/ui/Pagination.jsx` | Create | Page navigation component |
| `client/src/components/ui/Disclosure.jsx` | Create | Collapsible panel component |
| `client/src/components/WeeklyTrend.jsx` | Create | Two trend charts (win rate line + PnL bar) |
| `client/src/components/StreakKpis.jsx` | Create | Current streak + max win streak + max drawdown KPIs |

---

### Task 1: Database migration — `date` → `open_time` + `close_time`

**Files:**
- Modify: `server/db.js:27-48` (CREATE TABLE), `server/db.js:139-171` (existing migrations)

- [ ] **Step 1: Update the CREATE TABLE statement**

In `server/db.js`, replace the `trades` table definition (the one inside `db.exec`):

Change line 30 from:
```
    date TEXT NOT NULL,
```
to:
```
    open_time TEXT NOT NULL,
    close_time TEXT,
```

- [ ] **Step 2: Add the migration block**

Add after the `risk_amount` migration block (after line 223, before `export default db`):

```javascript
// Migration: rename date → open_time, add close_time
const tradeColsTime = db.prepare("PRAGMA table_info(trades)").all()
const hasDate = tradeColsTime.some(c => c.name === 'date')
const hasOpenTime = tradeColsTime.some(c => c.name === 'open_time')
if (hasDate && !hasOpenTime) {
  db.exec(`
    ALTER TABLE trades RENAME TO trades_old_time;
    CREATE TABLE trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      open_time TEXT NOT NULL,
      close_time TEXT,
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
      risk_amount REAL DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO trades (id, user_id, open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at)
      SELECT id, user_id, date || 'T00:00', NULL, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at FROM trades_old_time;
    DROP TABLE trades_old_time;
  `)
}
```

- [ ] **Step 3: Verify server starts**

Run: `cd /home/lz/workspace/trading-journal && node -c server/db.js`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add server/db.js && git commit -m "feat: migrate trades.date to open_time + add close_time column"
```

---

### Task 2: Update trades API — field rename + filtering + pagination

**Files:**
- Modify: `server/routes/trades.js`

- [ ] **Step 1: Rewrite the GET handler with filtering and pagination**

Replace the entire GET handler (lines 7-18) with:

```javascript
// GET /api/trades - list trades with optional filtering and pagination
router.get('/', (req, res) => {
  try {
    const userId = req.session.userId
    const { date_from, date_to, pair, direction, sort, order, limit, offset } = req.query

    const sortOrder = order === 'asc' ? 'ASC' : 'DESC'
    const allowed = ['id', 'open_time', 'pair', 'gross_pnl', 'created_at']
    const sortCol = allowed.includes(sort) ? sort : 'open_time'

    const conditions = ['user_id = ?']
    const params = [userId]

    if (date_from) {
      conditions.push('open_time >= ?')
      params.push(date_from + 'T00:00')
    }
    if (date_to) {
      conditions.push('open_time <= ?')
      params.push(date_to + 'T23:59')
    }
    if (pair) {
      conditions.push('pair = ?')
      params.push(pair)
    }
    if (direction) {
      conditions.push('direction = ?')
      params.push(direction)
    }

    const where = conditions.join(' AND ')
    const total = db.prepare(`SELECT COUNT(*) as total FROM trades WHERE ${where}`).get(...params).total

    let sql = `SELECT * FROM trades WHERE ${where} ORDER BY ${sortCol} ${sortOrder}, id ${sortOrder}`
    const parsedLimit = parseInt(limit)
    const parsedOffset = parseInt(offset) || 0

    let trades
    if (parsedLimit > 0) {
      sql += ' LIMIT ? OFFSET ?'
      trades = db.prepare(sql).all(...params, parsedLimit, parsedOffset)
    } else {
      trades = db.prepare(sql).all(...params)
    }

    res.json({ trades, total, limit: parsedLimit || 0, offset: parsedOffset })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 2: Update POST handler field names**

In the POST handler (line 22-54), replace all `date` references:

Replace line 25:
```javascript
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
```
with:
```javascript
    const { open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
```

Replace line 27:
```javascript
    const tradeDate = date || new Date().toISOString().split('T')[0]
```
with:
```javascript
    const now = new Date()
    const tradeOpenTime = open_time || `${now.toISOString().split('T')[0]}T${now.toTimeString().slice(0,5)}`
    const tradeCloseTime = close_time || null
```

Replace the INSERT statement (lines 43-46):
```javascript
    const stmt = db.prepare(`
      INSERT INTO trades (user_id, open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
```

Replace the `stmt.run(...)` call (line 49):
```javascript
    const result = stmt.run(userId, tradeOpenTime, tradeCloseTime, pair, direction, tradeStrategy, tradeTimeframe, lots || null, defaultEntry ?? null, defaultStop ?? null, target || null, exit_price ?? null, gross_pnl ?? null, swap || 0, score || null, emotion || null, notes || null, tradeStatus, risk_amount ?? null)
```

- [ ] **Step 3: Update PUT handler field names**

In the PUT handler (line 57-91), replace line 61:
```javascript
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
```
with:
```javascript
    const { open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
```

Replace the UPDATE statement (lines 74-76):
```javascript
    const stmt = db.prepare(`
      UPDATE trades SET open_time=?, close_time=?, pair=?, direction=?, strategy=?, timeframe=?, lots=?, entry=?, stop=?, target=?, exit_price=?, gross_pnl=?, swap=?, score=?, emotion=?, notes=?, status=?, risk_amount=?, updated_at=datetime('now')
      WHERE id=? AND user_id=?
    `)
```

Replace the `stmt.run(...)` call (lines 78-84):
```javascript
    stmt.run(
      open_time ?? existing.open_time, close_time !== undefined ? close_time : existing.close_time,
      pair ?? existing.pair, direction ?? existing.direction,
      strategy ?? existing.strategy, timeframe ?? existing.timeframe, lots || existing.lots,
      entry ?? existing.entry, stop ?? existing.stop, target || existing.target,
      exit_price ?? null, gross_pnl ?? null, swap || 0,
      score || null, emotion || null, notes || null,
      tradeStatus, risk_amount ?? existing.risk_amount, req.params.id, userId
    )
```

- [ ] **Step 4: Verify syntax**

Run: `node -c /home/lz/workspace/trading-journal/server/routes/trades.js`
Expected: No syntax errors

- [ ] **Step 5: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add server/routes/trades.js && git commit -m "feat: add filtering + pagination to trades API, rename date to open_time"
```

---

### Task 3: Update export/import — field name compatibility

**Files:**
- Modify: `server/index.js:54-125`

- [ ] **Step 1: Update export route**

Replace lines 59-63:
```javascript
    let tradeQuery = 'SELECT * FROM trades WHERE user_id = ?'
    const params = [userId]
    if (from) { tradeQuery += ' AND date >= ?'; params.push(from) }
    if (to) { tradeQuery += ' AND date <= ?'; params.push(to) }
    tradeQuery += ' ORDER BY date DESC'
```
with:
```javascript
    let tradeQuery = 'SELECT * FROM trades WHERE user_id = ?'
    const params = [userId]
    if (from) { tradeQuery += ' AND open_time >= ?'; params.push(from + 'T00:00') }
    if (to) { tradeQuery += ' AND open_time <= ?'; params.push(to + 'T23:59') }
    tradeQuery += ' ORDER BY open_time DESC'
```

- [ ] **Step 2: Update import route with backward compatibility**

Replace lines 94-100:
```javascript
        const stmt = db.prepare(`
          INSERT INTO trades (user_id, date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const t of trades) {
          const isMissed = t.status === 'missed'
          stmt.run(userId, t.date, t.pair, t.direction, t.strategy, t.timeframe, t.lots ?? null, isMissed ? (t.entry ?? 0) : (t.entry ?? null), isMissed ? (t.stop ?? 0) : (t.stop ?? null), t.target ?? null, t.exit_price ?? null, t.gross_pnl ?? null, t.swap ?? 0, t.score ?? null, t.emotion ?? null, t.notes ?? null, t.status || 'closed', t.risk_amount ?? null, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString())
```
with:
```javascript
        const stmt = db.prepare(`
          INSERT INTO trades (user_id, open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const t of trades) {
          const isMissed = t.status === 'missed'
          // Backward compat: old exports have 'date' field, new have 'open_time'
          const openTime = t.open_time || (t.date ? t.date + 'T00:00' : new Date().toISOString().slice(0, 16))
          const closeTime = t.close_time || null
          stmt.run(userId, openTime, closeTime, t.pair, t.direction, t.strategy, t.timeframe, t.lots ?? null, isMissed ? (t.entry ?? 0) : (t.entry ?? null), isMissed ? (t.stop ?? 0) : (t.stop ?? null), t.target ?? null, t.exit_price ?? null, t.gross_pnl ?? null, t.swap ?? 0, t.score ?? null, t.emotion ?? null, t.notes ?? null, t.status || 'closed', t.risk_amount ?? null, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString())
```

- [ ] **Step 3: Verify syntax**

Run: `node -c /home/lz/workspace/trading-journal/server/index.js`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add server/index.js && git commit -m "feat: update export/import for open_time field with backward compat"
```

---

### Task 4: Fix calc.js — R-multiple, streaks, weekly trends

**Files:**
- Modify: `client/src/lib/calc.js`

- [ ] **Step 1: Rewrite calc.js with all enhancements**

Replace the entire file content:

```javascript
import { SPREAD_COST, WEEKDAYS } from './constants'

const weekday = (d) => WEEKDAYS[new Date(d).getDay()]

// Get ISO week string (YYYY-Www) from a date string
function isoWeek(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function calcTrade(t, spreadCostMap) {
  const costMap = spreadCostMap || SPREAD_COST
  const entry = parseFloat(t.entry) || 0
  const stop = parseFloat(t.stop) || 0
  const exitPrice = parseFloat(t.exit_price) || 0
  const lots = parseFloat(t.lots) || 0
  const gross = parseFloat(t.gross_pnl) || 0
  const swap = parseFloat(t.swap) || 0
  const isBuy = t.direction.startsWith("多")

  const stopPips = stop > 0 ? Math.abs(entry - stop) : 0
  const pnlPips = isBuy ? exitPrice - entry : entry - exitPrice
  const spread = (costMap[t.pair] || 5) * lots
  const netPnl = gross + swap
  const dollarPerPip = pnlPips !== 0 ? gross / pnlPips : 0

  // R-multiple: prefer risk_amount, fallback to stopPips * dollarPerPip
  const riskAmount = parseFloat(t.risk_amount)
  const riskDollars = riskAmount > 0
    ? riskAmount
    : (stopPips > 0 && dollarPerPip > 0 ? stopPips * dollarPerPip : 0)
  const rMultiple = riskDollars > 0 ? Math.round(netPnl / riskDollars * 100) / 100 : null

  return {
    ...t,
    weekday: weekday(t.open_time),
    stopPips,
    pnlPips,
    rMultiple,
    spread: Math.round(spread * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
  }
}

export function calcStats(trades, spreadCostMap) {
  const activeTrades = trades.filter(t => t.status !== 'missed')
  const computed = activeTrades.map(t => calcTrade(t, spreadCostMap))
  if (computed.length === 0) return null

  const wins = computed.filter(t => t.netPnl > 0)
  const losses = computed.filter(t => t.netPnl < 0)
  const totalNet = computed.reduce((s, t) => s + t.netPnl, 0)
  const totalGross = computed.reduce((s, t) => s + (parseFloat(t.gross_pnl) || 0), 0)
  const totalSpread = computed.reduce((s, t) => s + t.spread, 0)
  const totalSwap = computed.reduce((s, t) => s + (parseFloat(t.swap) || 0), 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length : 0

  // Average R excludes null (uncalculable) entries
  const rTrades = computed.filter(t => t.rMultiple !== null)
  const avgR = rTrades.length > 0
    ? Math.round(rTrades.reduce((s, t) => s + t.rMultiple, 0) / rTrades.length * 100) / 100
    : 0

  // Breakdowns
  const byPair = {}; const byStrat = {}; const byEmo = {}; const byDay = {}; const byTf = {}
  computed.forEach(t => {
    for (const [map, key] of [[byPair, t.pair],[byStrat, t.strategy],[byEmo, t.emotion],[byDay, t.weekday],[byTf, t.timeframe]]) {
      if (!map[key]) map[key] = { count: 0, wins: 0, totalPnl: 0, totalR: 0, rCount: 0 }
      map[key].count++
      if (t.netPnl > 0) map[key].wins++
      map[key].totalPnl += t.netPnl
      if (t.rMultiple !== null) {
        map[key].totalR += t.rMultiple
        map[key].rCount++
      }
    }
  })

  const toArr = (m) => Object.entries(m).map(([k, v]) => ({
    name: k, count: v.count,
    winRate: v.count ? Math.round(v.wins / v.count * 1000) / 10 : 0,
    pnl: Math.round(v.totalPnl * 100) / 100,
    avgR: v.rCount > 0 ? Math.round(v.totalR / v.rCount * 100) / 100 : 0
  }))

  // Cumulative PnL curve (sorted by open_time)
  let cumPnl = 0
  const sorted = [...computed].sort((a, b) => a.open_time.localeCompare(b.open_time) || a.id - b.id)
  const cumData = sorted.map((t, i) => { cumPnl += t.netPnl; return { idx: i + 1, date: t.open_time.slice(0, 10), pnl: Math.round(cumPnl * 100) / 100 } })

  // Streaks (based on time-sorted trades)
  let currentStreak = { type: null, count: 0 }
  let maxWinStreak = 0
  let maxLossStreak = 0
  let winStreak = 0
  let lossStreak = 0
  for (const t of sorted) {
    if (t.netPnl > 0) {
      winStreak++
      lossStreak = 0
      if (winStreak > maxWinStreak) maxWinStreak = winStreak
    } else {
      lossStreak++
      winStreak = 0
      if (lossStreak > maxLossStreak) maxLossStreak = lossStreak
    }
  }
  // Current streak from the last trade
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1]
    currentStreak.type = last.netPnl > 0 ? 'win' : 'loss'
    currentStreak.count = 1
    for (let i = sorted.length - 2; i >= 0; i--) {
      const isWin = sorted[i].netPnl > 0
      if ((currentStreak.type === 'win' && isWin) || (currentStreak.type === 'loss' && !isWin)) {
        currentStreak.count++
      } else {
        break
      }
    }
  }

  // Max drawdown (peak-to-trough on cumulative PnL)
  let peak = 0
  let maxDrawdown = 0
  let cumPnlDD = 0
  for (const t of sorted) {
    cumPnlDD += t.netPnl
    if (cumPnlDD > peak) peak = cumPnlDD
    const dd = cumPnlDD - peak
    if (dd < maxDrawdown) maxDrawdown = dd
  }

  // Weekly trend (last 8 ISO weeks)
  const now = new Date()
  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    weeks.push(isoWeek(d))
  }
  // Deduplicate and keep last 8 unique
  const uniqueWeeks = [...new Set(weeks)].slice(-8)

  const weekMap = {}
  for (const w of uniqueWeeks) {
    weekMap[w] = { count: 0, wins: 0, totalPnl: 0 }
  }
  for (const t of computed) {
    const w = isoWeek(t.open_time)
    if (weekMap[w]) {
      weekMap[w].count++
      if (t.netPnl > 0) weekMap[w].wins++
      weekMap[w].totalPnl += t.netPnl
    }
  }
  const weeklyTrend = uniqueWeeks.map(w => ({
    week: w,
    count: weekMap[w].count,
    winRate: weekMap[w].count > 0 ? Math.round(weekMap[w].wins / weekMap[w].count * 1000) / 10 : 0,
    netPnl: Math.round(weekMap[w].totalPnl * 100) / 100,
  }))

  return {
    total: computed.length, wins: wins.length, losses: losses.length,
    winRate: Math.round(wins.length / computed.length * 1000) / 10,
    totalNet: Math.round(totalNet * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    totalSpread: Math.round(totalSpread * 100) / 100,
    totalSwap: Math.round(totalSwap * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: losses.length > 0 ? Math.round(Math.abs(wins.reduce((s, t) => s + t.netPnl, 0) / losses.reduce((s, t) => s + t.netPnl, 0)) * 100) / 100 : 0,
    avgR,
    byPair: toArr(byPair).sort((a, b) => b.pnl - a.pnl),
    byStrat: toArr(byStrat).sort((a, b) => b.pnl - a.pnl),
    byEmo: toArr(byEmo).filter(x => x.count > 0),
    byDay: toArr(byDay),
    byTf: toArr(byTf).filter(x => x.count > 0),
    cumData,
    computed,
    currentStreak,
    maxWinStreak,
    maxLossStreak,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    weeklyTrend,
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /home/lz/workspace/trading-journal && node -e "import('./client/src/lib/calc.js')" 2>&1 || echo "Check manually — ESM import may need bundler"`

- [ ] **Step 3: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/lib/calc.js && git commit -m "feat: fix R-multiple calc (risk_amount priority), add streaks/drawdown/weeklyTrend"
```

---

### Task 5: Update useApi.js — getTrades with query params

**Files:**
- Modify: `client/src/hooks/useApi.js:31`

- [ ] **Step 1: Update getTrades to accept params**

Replace line 31:
```javascript
  getTrades: () => request('/trades'),
```
with:
```javascript
  getTrades: (params) => {
    if (!params) return request('/trades')
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') qs.set(k, v)
    }
    const str = qs.toString()
    return request(`/trades${str ? '?' + str : ''}`)
  },
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/hooks/useApi.js && git commit -m "feat: getTrades accepts query params for filtering/pagination"
```

---

### Task 6: Update TradeForm — datetime-local + close_time

**Files:**
- Modify: `client/src/components/TradeForm.jsx`

- [ ] **Step 1: Update the today() helper and emptyTrade**

Replace lines 8-17:
```javascript
const today = () => new Date().toISOString().split("T")[0]

export function emptyTrade(pairs) {
  const pairList = pairs && pairs.length > 0 ? pairs : DEFAULT_PAIRS
  return {
    date: today(), pair: pairList[0], direction: "多(Buy)",
    strategy: "趋势跟踪", timeframe: "H4", lots: "", entry: "", stop: "", target: "",
    exit_price: "", gross_pnl: "", swap: "0", score: "B-基本执行", emotion: "冷静理性", notes: "",
    status: "closed", risk_amount: ""
  }
}
```
with:
```javascript
const now = () => {
  const d = new Date()
  return `${d.toISOString().split('T')[0]}T${d.toTimeString().slice(0, 5)}`
}

export function emptyTrade(pairs) {
  const pairList = pairs && pairs.length > 0 ? pairs : DEFAULT_PAIRS
  return {
    open_time: now(), close_time: "", pair: pairList[0], direction: "多(Buy)",
    strategy: "趋势跟踪", timeframe: "H4", lots: "", entry: "", stop: "", target: "",
    exit_price: "", gross_pnl: "", swap: "0", score: "B-基本执行", emotion: "冷静理性", notes: "",
    status: "closed", risk_amount: ""
  }
}
```

- [ ] **Step 2: Update the date input to datetime-local**

Replace line 110:
```javascript
            <Field label="日期"><Input type="date" value={form.date} onChange={uf("date")} /></Field>
```
with:
```javascript
            <Field label="开仓时间"><Input type="datetime-local" value={form.open_time} onChange={uf("open_time")} /></Field>
```

- [ ] **Step 3: Add close_time field in exit section**

After line 128 (the exit_price field), add the close_time field. Find:
```javascript
            <Field label="出场价 *" required={isRequired("exit_price")}><Input value={form.exit_price} onChange={uf("exit_price")} placeholder="1.03720" /></Field>
```
and add immediately after:
```javascript
            <Field label="平仓时间"><Input type="datetime-local" value={form.close_time || now()} onChange={uf("close_time")} /></Field>
```

- [ ] **Step 4: Update the close mode auto-fill of close_time**

In the handleSubmit function (around line 64-65), add close_time default for closing trades. After `if (isClose) payload.status = "closed"` add:
```javascript
    if (isClose && !payload.close_time) payload.close_time = now()
```

- [ ] **Step 5: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/TradeForm.jsx && git commit -m "feat: TradeForm uses datetime-local for open_time, adds close_time field"
```

---

### Task 7: Create TradeFilter component

**Files:**
- Create: `client/src/components/TradeFilter.jsx`

- [ ] **Step 1: Create the filter component**

```javascript
import { useState } from 'react'
import Select from './ui/Select'

const QUICK_OPTIONS = [
  { label: '今天', key: 'today' },
  { label: '本周', key: 'week' },
  { label: '本月', key: 'month' },
  { label: '全部', key: 'all' },
]

function getDateRange(key) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const today = `${yyyy}-${mm}-${dd}`

  if (key === 'today') return { date_from: today, date_to: today }
  if (key === 'week') {
    const d = new Date(now)
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    const mon = d.toISOString().split('T')[0]
    const sun = new Date(d)
    sun.setDate(sun.getDate() + 6)
    return { date_from: mon, date_to: sun.toISOString().split('T')[0] }
  }
  if (key === 'month') {
    const first = `${yyyy}-${mm}-01`
    const last = new Date(yyyy, now.getMonth() + 1, 0).toISOString().split('T')[0]
    return { date_from: first, date_to: last }
  }
  return { date_from: null, date_to: null }
}

export default function TradeFilter({ filter, onChange, pairs }) {
  const [active, setActive] = useState('all')

  const handleQuick = (key) => {
    setActive(key)
    const range = getDateRange(key)
    onChange({ ...filter, ...range })
  }

  const handlePair = (v) => {
    onChange({ ...filter, pair: v || null })
  }

  const handleDirection = (v) => {
    onChange({ ...filter, direction: v || null })
  }

  const pairOptions = ['全部', ...(pairs || [])]
  const dirOptions = ['全部', '多(Buy)', '空(Sell)']

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 overflow-x-auto">
        {QUICK_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleQuick(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-all duration-200
              ${active === opt.key
                ? 'bg-accent text-white'
                : 'text-muted border border-border hover:text-text hover:border-accent/50'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="hidden sm:flex items-center gap-2 ml-auto">
        <div className="w-[120px]">
          <Select
            value={filter.pair || '全部'}
            onChange={v => handlePair(v === '全部' ? null : v)}
            options={pairOptions}
          />
        </div>
        <div className="w-[100px]">
          <Select
            value={filter.direction || '全部'}
            onChange={v => handleDirection(v === '全部' ? null : v)}
            options={dirOptions}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/TradeFilter.jsx && git commit -m "feat: add TradeFilter component with quick date buttons + pair/direction dropdowns"
```

---

### Task 8: Create Pagination component

**Files:**
- Create: `client/src/components/ui/Pagination.jsx`

- [ ] **Step 1: Create the pagination component**

```javascript
export default function Pagination({ total, limit, offset, onChange }) {
  if (!limit || total <= limit) {
    return total > 0 ? <div className="mt-4 text-xs text-muted">共 {total} 条记录</div> : null
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const goTo = (page) => {
    onChange((page - 1) * limit)
  }

  // Build page numbers with ellipsis
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted">
      <span className="text-xs">共 {total} 笔交易</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 rounded text-xs cursor-pointer hover:text-text transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >‹</button>
        {/* Desktop: page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="px-1 text-xs">...</span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p)}
                className={`w-7 h-7 rounded text-xs cursor-pointer transition-all duration-200
                  ${p === currentPage
                    ? 'bg-accent text-white font-bold'
                    : 'hover:text-text hover:bg-hover'
                  }`}
              >{p}</button>
            )
          )}
        </div>
        {/* Mobile: simple page indicator */}
        <span className="sm:hidden text-xs">{currentPage}/{totalPages}</span>
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 rounded text-xs cursor-pointer hover:text-text transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >›</button>
      </div>
      <span className="text-xs hidden sm:inline">每页 {limit} 笔</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/ui/Pagination.jsx && git commit -m "feat: add Pagination component with page numbers and mobile simple view"
```

---

### Task 9: Create Disclosure component

**Files:**
- Create: `client/src/components/ui/Disclosure.jsx`

- [ ] **Step 1: Create the collapsible panel component**

```javascript
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Disclosure({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 sm:px-5 py-3 cursor-pointer hover:bg-hover transition-colors"
      >
        <h4 className="text-sm font-bold">{title}</h4>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-5">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/ui/Disclosure.jsx && git commit -m "feat: add Disclosure collapsible panel component"
```

---

### Task 10: Create WeeklyTrend component

**Files:**
- Create: `client/src/components/WeeklyTrend.jsx`

- [ ] **Step 1: Create the two trend charts component**

```javascript
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const THEME = {
  light: { border: '#e2e8f0', muted: '#94a3b8', green: '#16a34a', red: '#dc2626', accent: '#3b82f6', card: '#ffffff' },
  dark: { border: '#1e293b', muted: '#64748b', green: '#10b981', red: '#ef4444', accent: '#3b82f6', card: '#111827' },
}

export default function WeeklyTrend({ weeklyTrend, theme = 'dark' }) {
  const C = THEME[theme] || THEME.dark
  if (!weeklyTrend || weeklyTrend.length === 0) return null

  const tooltipStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }
  const shortWeek = (w) => w.replace(/^\d{4}-/, '')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-xl p-3 sm:p-5 shadow-sm">
        <h4 className="text-sm font-bold mb-3">周胜率趋势</h4>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="week" stroke={C.muted} fontSize={10} tickFormatter={shortWeek} />
            <YAxis stroke={C.muted} fontSize={10} tickFormatter={v => v + '%'} domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => [v + '%', '胜率']} labelFormatter={l => `第${shortWeek(l)}周`} />
            <Line type="monotone" dataKey="winRate" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.accent }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-card border border-border rounded-xl p-3 sm:p-5 shadow-sm">
        <h4 className="text-sm font-bold mb-3">周净盈亏趋势</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="week" stroke={C.muted} fontSize={10} tickFormatter={shortWeek} />
            <YAxis stroke={C.muted} fontSize={10} tickFormatter={v => '$' + v} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => ['$' + v, '净盈亏']} labelFormatter={l => `第${shortWeek(l)}周`} />
            <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
              {weeklyTrend.map((e, i) => <Cell key={i} fill={e.netPnl >= 0 ? C.green : C.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/WeeklyTrend.jsx && git commit -m "feat: add WeeklyTrend component with win rate line + PnL bar charts"
```

---

### Task 11: Create StreakKpis component

**Files:**
- Create: `client/src/components/StreakKpis.jsx`

- [ ] **Step 1: Create the streak KPI cards**

```javascript
import KpiCard from './ui/KpiCard'

export default function StreakKpis({ stats }) {
  if (!stats) return null

  const { currentStreak, maxWinStreak, maxDrawdown } = stats

  const streakLabel = currentStreak.type === 'win' ? `连胜 ${currentStreak.count} 笔` : `连亏 ${currentStreak.count} 笔`
  const streakColor = currentStreak.type === 'win' ? '#10b981' : '#ef4444'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-2 sm:gap-3">
      <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <KpiCard
          label="当前连续"
          value={currentStreak.count > 0 ? streakLabel : '—'}
          color={currentStreak.count > 0 ? streakColor : undefined}
        />
      </div>
      <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '350ms' }}>
        <KpiCard
          label="最大连胜"
          value={`${maxWinStreak} 笔`}
          color="#10b981"
        />
      </div>
      <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <KpiCard
          label="最大回撤"
          value={maxDrawdown < 0 ? `$${maxDrawdown}` : '$0'}
          color={maxDrawdown < 0 ? '#ef4444' : undefined}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/StreakKpis.jsx && git commit -m "feat: add StreakKpis component (current streak, max win streak, max drawdown)"
```

---

### Task 12: Update KpiCard — add comparison prop

**Files:**
- Modify: `client/src/components/ui/KpiCard.jsx`

- [ ] **Step 1: Add comparison display**

Replace the entire file:

```javascript
import { useCountUp } from '../../hooks/useCountUp'

export default function KpiCard({ label, value, color, sub, comparison }) {
  const numericValue = parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  const isNumeric = !isNaN(numericValue) && isFinite(numericValue)
  const prefix = typeof value === 'string' ? value.match(/^[^0-9.\-]*/)?.[0] || '' : ''
  const suffix = typeof value === 'string' ? value.match(/[^0-9.\-]*$/)?.[0] || '' : ''

  const animated = useCountUp(isNumeric ? numericValue : 0)

  const decimalMatch = String(value).match(/\.(\d+)/)
  const decimals = decimalMatch ? decimalMatch[1].length : 0

  const displayValue = isNumeric
    ? `${prefix}${animated.toFixed(decimals)}${suffix}`
    : value

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex-1 min-w-[140px] shadow-sm
      hover:border-accent/30 transition-all duration-300 card-hover">
      <div className="text-[11px] text-muted tracking-wide uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color || undefined }}>
        {displayValue}
      </div>
      {comparison && (
        <div className={`text-[10px] mt-1 font-medium ${
          comparison.direction === 'up' ? 'text-green' :
          comparison.direction === 'down' ? 'text-red' : 'text-muted'
        }`}>
          {comparison.direction === 'up' ? '↑' : comparison.direction === 'down' ? '↓' : '→'} vs上周 {comparison.value}
        </div>
      )}
      {!comparison && sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/ui/KpiCard.jsx && git commit -m "feat: KpiCard supports comparison prop for week-over-week arrows"
```

---

### Task 13: Update TradeTable — server-side pagination + datetime display

**Files:**
- Modify: `client/src/components/TradeTable.jsx`

- [ ] **Step 1: Rewrite TradeTable for server-driven data**

Replace the entire file:

```javascript
import { useState, useMemo } from 'react'
import { calcTrade } from '../lib/calc'
import EmptyState from './EmptyState'
import Pagination from './ui/Pagination'

const SORTABLE = {
  open_time: '日期',
  pair: '品种',
  rMultiple: 'R',
  netPnl: '净盈亏',
  score: '评分',
}

function SortHeader({ col, label, sortKey, sortOrder, onSort }) {
  const active = sortKey === col
  return (
    <th
      className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide cursor-pointer select-none hover:text-text transition-colors"
      onClick={() => onSort(col)}
    >
      {label} {active ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
    </th>
  )
}

function formatTime(openTime) {
  if (!openTime) return ''
  // "2026-03-27T14:30" → "03/27 14:30"
  const [datePart, timePart] = openTime.split('T')
  if (!datePart) return openTime
  const [, mm, dd] = datePart.split('-')
  return `${mm}/${dd} ${timePart || '00:00'}`
}

function TradeCard({ trade: t, index, animIndex, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-card border border-border rounded-xl p-3 active:scale-[0.97] active:opacity-80 transition-transform duration-100 animate-fade-in-up" style={{ animationDelay: `${animIndex * 40}ms` }}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{t.pair}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.direction.startsWith("多") ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
            {t.direction.startsWith("多") ? "多" : "空"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-sm ${t.rMultiple != null && t.rMultiple >= 0 ? 'text-green' : 'text-red'}`}>
            {t.rMultiple != null ? `${t.rMultiple > 0 ? "+" : ""}${t.rMultiple}R` : '—'}
          </span>
          <span className={`font-mono font-bold text-sm ${t.netPnl >= 0 ? 'text-green' : 'text-red'}`}>
            ${t.netPnl.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-muted">
        <span>{formatTime(t.open_time)} · {t.strategy} · {t.timeframe}</span>
        <span>{t.score?.split("-")[0]}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="grid grid-cols-3 gap-2 text-xs mb-3">
            <div><span className="text-muted">手数</span> <span className="font-mono">{t.lots}</span></div>
            <div><span className="text-muted">入场</span> <span className="font-mono">{t.entry}</span></div>
            <div><span className="text-muted">出场</span> <span className="font-mono">{t.exit_price}</span></div>
          </div>
          {t.notes && <p className="text-xs text-muted mb-3">{t.notes}</p>}
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); onEdit(t) }} className="text-accent text-xs cursor-pointer">编辑</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(t.id) }} className="text-red text-xs cursor-pointer">删除</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TradeTable({ trades, onEdit, onDelete, spreadCostMap, pagination, onPageChange }) {
  const [sortKey, setSortKey] = useState('open_time')
  const [sortOrder, setSortOrder] = useState('desc')

  const computed = useMemo(() => trades.map(t => calcTrade(t, spreadCostMap)), [trades, spreadCostMap])

  // Client-side sort on already-paged data
  const sorted = useMemo(() => {
    const arr = [...computed]
    arr.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (va == null) va = ''
      if (vb == null) vb = ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortOrder === 'asc' ? -1 : 1
      if (va > vb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [computed, sortKey, sortOrder])

  const handleSort = (col) => {
    if (sortKey === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortOrder('desc')
    }
  }

  if (computed.length === 0 && (!pagination || pagination.total === 0)) {
    return <EmptyState type="trades" />
  }

  return (
    <div>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sorted.map((t, i) => (
          <TradeCard key={t.id} trade={t} index={(pagination ? pagination.offset : 0) + i + 1} animIndex={i} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">#</th>
              <SortHeader col="open_time" label="日期" sortKey={sortKey} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader col="pair" label="品种" sortKey={sortKey} sortOrder={sortOrder} onSort={handleSort} />
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">方向</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">策略</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">周期</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">手数</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">入场</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">出场</th>
              <SortHeader col="rMultiple" label="R" sortKey={sortKey} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader col="netPnl" label="净盈亏" sortKey={sortKey} sortOrder={sortOrder} onSort={handleSort} />
              <SortHeader col="score" label="评分" sortKey={sortKey} sortOrder={sortOrder} onSort={handleSort} />
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide">情绪</th>
              <th className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-hover transition-colors duration-150">
                <td className="px-3 py-3 text-muted">{(pagination ? pagination.offset : 0) + i + 1}</td>
                <td className="px-3 py-3 whitespace-nowrap" title={t.open_time}>
                  {formatTime(t.open_time)}
                  <span className="block text-[10px] text-muted">{t.weekday}</span>
                </td>
                <td className="px-3 py-3 font-semibold">{t.pair}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold
                    ${t.direction.startsWith("多")
                      ? 'bg-green/10 text-green'
                      : 'bg-red/10 text-red'}`}>
                    {t.direction.startsWith("多") ? "做多" : "做空"}
                  </span>
                </td>
                <td className="px-3 py-3 text-[11px]">{t.strategy}</td>
                <td className="px-3 py-3 text-[11px] text-muted">{t.timeframe}</td>
                <td className="px-3 py-3 font-mono">{t.lots}</td>
                <td className="px-3 py-3 font-mono text-[11px]">{t.entry}</td>
                <td className="px-3 py-3 font-mono text-[11px]">{t.exit_price}</td>
                <td className={`px-3 py-3 font-mono font-bold ${t.rMultiple != null && t.rMultiple >= 0 ? 'text-green' : 'text-red'}`}>
                  {t.rMultiple != null ? `${t.rMultiple > 0 ? "+" : ""}${t.rMultiple}R` : '—'}
                </td>
                <td className={`px-3 py-3 font-mono font-bold ${t.netPnl >= 0 ? 'text-green' : 'text-red'}`}>
                  ${t.netPnl.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-[10px]">{t.score?.split("-")[0]}</td>
                <td className="px-3 py-3 text-[10px]">{t.emotion}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <button onClick={() => onEdit(t)} className="text-accent hover:text-accent/80 cursor-pointer mr-2 transition-colors">
                    编辑
                  </button>
                  <button onClick={() => onDelete(t.id)} className="text-red hover:text-red/80 cursor-pointer transition-colors">
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        total={pagination ? pagination.total : sorted.length}
        limit={pagination ? pagination.limit : 0}
        offset={pagination ? pagination.offset : 0}
        onChange={onPageChange || (() => {})}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/TradeTable.jsx && git commit -m "feat: TradeTable uses server pagination, displays datetime format MM/DD HH:mm"
```

---

### Task 14: Update OpenPositions — hold duration

**Files:**
- Modify: `client/src/components/OpenPositions.jsx`

- [ ] **Step 1: Add duration calculation and display**

Replace the entire file:

```javascript
function formatDuration(openTime) {
  if (!openTime) return ''
  const start = new Date(openTime)
  const now = new Date()
  const diffMs = now - start
  if (diffMs < 0) return ''
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  if (days > 0) return `${days}天${remainHours}小时`
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60)
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

export default function OpenPositions({ openTrades, onClose, onDelete }) {
  if (!openTrades || openTrades.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-muted mb-3">持仓中 ({openTrades.length})</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {openTrades.map((trade, i) => (
          <div key={trade.id} className="bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform duration-100 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{trade.pair}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  trade.direction.includes('Buy') ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                }`}>
                  {trade.direction}
                </span>
              </div>
              <span className="text-[11px] text-muted">{formatDuration(trade.open_time)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <div className="text-muted mb-0.5">入场价</div>
                <div className="font-mono font-medium">{trade.entry}</div>
              </div>
              <div>
                <div className="text-muted mb-0.5">止损价</div>
                <div className="font-mono font-medium text-red">{trade.stop}</div>
              </div>
              <div>
                <div className="text-muted mb-0.5">目标价</div>
                <div className="font-mono font-medium text-green">{trade.target || '—'}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onClose(trade)}
                className="flex-1 bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
                  hover:brightness-110 active:scale-95 transition-all duration-200"
              >
                平仓
              </button>
              <button
                onClick={() => onDelete(trade.id)}
                className="text-muted border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer
                  hover:text-red hover:border-red/30 active:scale-95 transition-all duration-200"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/OpenPositions.jsx && git commit -m "feat: OpenPositions shows hold duration from open_time"
```

---

### Task 15: Update PsychologyPanel — open_time field

**Files:**
- Modify: `client/src/components/PsychologyPanel.jsx`

- [ ] **Step 1: Replace date references with open_time**

Replace line 13:
```javascript
  const [missedForm, setMissedForm] = useState({ date: today(), pair: pairs[0] || '', direction: '多(Buy)', notes: '' })
```
with:
```javascript
  const [missedForm, setMissedForm] = useState({ open_time: today() + 'T00:00', pair: pairs[0] || '', direction: '多(Buy)', notes: '' })
```

Replace line 19 (`t.date === todayStr`):
```javascript
    trades.filter(t => t.status === 'open' && t.date === todayStr),
```
with:
```javascript
    trades.filter(t => t.status === 'open' && t.open_time && t.open_time.startsWith(todayStr)),
```

Replace line 39 (`t.date === todayStr`):
```javascript
    trades.filter(t => t.status === 'missed' && t.date === todayStr),
```
with:
```javascript
    trades.filter(t => t.status === 'missed' && t.open_time && t.open_time.startsWith(todayStr)),
```

Replace line 46 (`date: missedForm.date`):
```javascript
      date: missedForm.date || todayStr,
```
with:
```javascript
      open_time: missedForm.open_time || todayStr + 'T00:00',
```

Replace line 52 (reset form):
```javascript
    setMissedForm({ date: today(), pair: pairs[0] || '', direction: '多(Buy)', notes: '' })
```
with:
```javascript
    setMissedForm({ open_time: today() + 'T00:00', pair: pairs[0] || '', direction: '多(Buy)', notes: '' })
```

Replace line 100 (the date input):
```javascript
              <Input type="date" value={missedForm.date} onChange={v => setMissedForm(f => ({ ...f, date: v }))} />
```
with:
```javascript
              <Input type="date" value={missedForm.open_time.split('T')[0]} onChange={v => setMissedForm(f => ({ ...f, open_time: v + 'T00:00' }))} />
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/PsychologyPanel.jsx && git commit -m "feat: PsychologyPanel uses open_time field"
```

---

### Task 16: Update Dashboard — comparison, trends, collapsible tables

**Files:**
- Modify: `client/src/components/Dashboard.jsx`

- [ ] **Step 1: Rewrite Dashboard with all enhancements**

Replace the entire file:

```javascript
import { useMemo, useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import KpiCard from './ui/KpiCard'
import Disclosure from './ui/Disclosure'
import EmptyState from './EmptyState'
import StreakKpis from './StreakKpis'
import WeeklyTrend from './WeeklyTrend'
import { calcStats } from '../lib/calc'
import { api } from '../hooks/useApi'

const THEME_COLORS = {
  light: { card: '#ffffff', border: '#e2e8f0', muted: '#94a3b8', accent: '#3b82f6', green: '#16a34a', red: '#dc2626', gold: '#d97706' },
  dark:  { card: '#111827', border: '#1e293b', muted: '#64748b', accent: '#3b82f6', green: '#10b981', red: '#ef4444', gold: '#f59e0b' },
}

function isoWeek(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getComparison(current, previous, invert) {
  if (previous == null || current == null) return null
  const diff = current - previous
  const pct = previous !== 0 ? Math.abs(diff / previous) : 0
  let direction = 'same'
  if (pct >= 0.05 || Math.abs(diff) > 0.5) {
    direction = diff > 0 ? 'up' : 'down'
  }
  if (invert && direction !== 'same') direction = direction === 'up' ? 'down' : 'up'
  return { value: typeof previous === 'number' && previous % 1 !== 0 ? previous.toFixed(2) : previous, direction }
}

export default function Dashboard({ trades, spreadCostMap, theme = 'dark' }) {
  const stats = useMemo(() => calcStats(trades, spreadCostMap), [trades, spreadCostMap])
  const C = THEME_COLORS[theme] || THEME_COLORS.dark
  const [violationStats, setViolationStats] = useState(null)
  useEffect(() => {
    api.getViolationStats().then(setViolationStats).catch(console.error)
  }, [])
  const tooltipStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }

  // Week-over-week comparison
  const currentWeek = isoWeek(new Date().toISOString())
  const lastWeekDate = new Date()
  lastWeekDate.setDate(lastWeekDate.getDate() - 7)
  const lastWeek = isoWeek(lastWeekDate.toISOString())

  const thisWeekTrades = useMemo(() =>
    trades.filter(t => t.status === 'closed' && t.open_time && isoWeek(t.open_time) === currentWeek),
    [trades, currentWeek]
  )
  const lastWeekTrades = useMemo(() =>
    trades.filter(t => t.status === 'closed' && t.open_time && isoWeek(t.open_time) === lastWeek),
    [trades, lastWeek]
  )
  const thisWeekStats = useMemo(() => calcStats(thisWeekTrades, spreadCostMap), [thisWeekTrades, spreadCostMap])
  const lastWeekStats = useMemo(() => calcStats(lastWeekTrades, spreadCostMap), [lastWeekTrades, spreadCostMap])

  const showComparison = thisWeekStats && lastWeekStats

  if (!stats) {
    return <EmptyState type="dashboard" />
  }

  const goodScoreRate = Math.round(
    stats.computed.filter(t => t.score?.startsWith("A") || t.score?.startsWith("B")).length / stats.computed.length * 100
  )

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const analysisData = [
    { title: '情绪分析', data: stats.byEmo, defaultOpen: !isMobile },
    { title: '策略分析', data: stats.byStrat, defaultOpen: !isMobile },
    { title: '品种分析', data: stats.byPair, defaultOpen: false },
    { title: '星期分析', data: stats.byDay, defaultOpen: false },
    { title: '周期分析', data: stats.byTf, defaultOpen: false },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Row 1 — main stats with comparison */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex gap-2 sm:gap-3">
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <KpiCard label="总交易数" value={stats.total}
            comparison={showComparison ? getComparison(thisWeekStats.total, lastWeekStats.total) : null} />
        </div>
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <KpiCard label="胜率" value={stats.winRate + "%"} color={stats.winRate >= 50 ? C.green : C.red}
            comparison={showComparison ? getComparison(thisWeekStats.winRate, lastWeekStats.winRate) : null} />
        </div>
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <KpiCard label="净盈亏" value={"$" + stats.totalNet.toFixed(0)} color={stats.totalNet >= 0 ? C.green : C.red}
            comparison={showComparison ? getComparison(thisWeekStats.totalNet, lastWeekStats.totalNet) : null} />
        </div>
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <KpiCard label="盈亏比" value={stats.profitFactor} color={stats.profitFactor >= 1.5 ? C.green : C.gold}
            comparison={showComparison ? getComparison(thisWeekStats.profitFactor, lastWeekStats.profitFactor) : null} />
        </div>
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <KpiCard label="平均R" value={stats.avgR + "R"} color={stats.avgR >= 0 ? C.green : C.red}
            comparison={showComparison ? getComparison(thisWeekStats.avgR, lastWeekStats.avgR) : null} />
        </div>
        <div className="flex-1 min-w-[140px] animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <KpiCard label="执行合格率" value={goodScoreRate + "%"} />
        </div>
      </div>

      {/* KPI Row 2 — streaks */}
      <StreakKpis stats={stats} />

      {/* Weekly Trends */}
      <WeeklyTrend weeklyTrend={stats.weeklyTrend} theme={theme} />

      {/* Core + Cost cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="核心指标">
          {[["盈利笔数", stats.wins], ["亏损笔数", stats.losses], ["平均盈利", "$" + stats.avgWin.toFixed(2)], ["平均亏损", "$" + stats.avgLoss.toFixed(2)]].map(([k, v]) => (
            <StatRow key={k} label={k} value={v} />
          ))}
        </Card>
        <Card title="成本分析">
          {[["账户盈亏", "$" + stats.totalGross.toFixed(2)], ["点差成本(参考)", "$" + Math.abs(stats.totalSpread).toFixed(2)], ["库存费", (stats.totalSwap >= 0 ? "+$" : "-$") + Math.abs(stats.totalSwap).toFixed(2)], ["净盈亏", "$" + stats.totalNet.toFixed(2)]].map(([k, v]) => (
            <StatRow key={k} label={k} value={v} />
          ))}
        </Card>
      </div>

      {/* Cumulative PnL */}
      {stats.cumData.length > 1 && (
        <Card title="累计净盈亏曲线">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.cumData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} />
              <YAxis stroke={C.muted} fontSize={10} tickFormatter={v => "$" + v} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => ["$" + v, "累计盈亏"]} />
              <Line type="monotone" dataKey="pnl" stroke={C.accent} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cross-Analysis Tables — collapsible */}
      <div className="space-y-3">
        {analysisData.map(({ title, data, defaultOpen }) => (
          <Disclosure key={title} title={title} defaultOpen={defaultOpen}>
            <AnalysisTable data={data} />
          </Disclosure>
        ))}
      </div>

      {/* Violation Analysis */}
      {violationStats && violationStats.totalViolations > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-bold mb-4">违规分析</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted mb-1">总违规次数</div>
              <div className="text-2xl font-bold text-red">{violationStats.totalViolations}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted mb-1">涉及交易笔数</div>
              <div className="text-2xl font-bold">{violationStats.tradesWithViolations}</div>
            </div>
          </div>
          {violationStats.topViolated.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted mb-3 font-medium">最常违反的政策</div>
              <div className="space-y-2">
                {violationStats.topViolated.slice(0, 5).map(v => {
                  const catLabel = v.category === 'rules' ? '规则' : v.category === 'strategy' ? '策略' : '风控'
                  return (
                    <div key={v.id} className="flex items-center gap-3">
                      <span className="text-[10px] bg-red/10 text-red px-1.5 py-0.5 rounded font-medium shrink-0">{catLabel}</span>
                      <span className="text-sm flex-1 truncate">{v.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-2 bg-red/20 rounded-full overflow-hidden" style={{ width: '80px' }}>
                          <div
                            className="h-full bg-red rounded-full"
                            style={{ width: `${(v.count / violationStats.topViolated[0].count) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted w-6 text-right">{v.count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnalysisTable({ data }) {
  if (!data || data.length === 0) return <div className="text-xs text-muted">暂无数据</div>
  const sorted = [...data].sort((a, b) => b.pnl - a.pnl)
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr>{["名称","交易数","胜率","净盈亏","平均R"].map(h => (
          <th key={h} className="px-2 py-1.5 text-left text-muted font-semibold border-b border-border text-[10px]">{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {sorted.map(d => (
          <tr key={d.name} className={`border-b border-border/30 ${d.count < 2 ? 'opacity-50' : ''}`}>
            <td className="px-2 py-1.5 font-semibold">{d.name}</td>
            <td className="px-2 py-1.5">{d.count}</td>
            <td className={`px-2 py-1.5 ${d.winRate >= 50 ? 'text-green' : 'text-red'}`}>{d.winRate}%</td>
            <td className={`px-2 py-1.5 font-mono ${d.pnl >= 0 ? 'text-green' : 'text-red'}`}>${d.pnl}</td>
            <td className="px-2 py-1.5 font-mono">{d.avgR}R</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-5 shadow-sm">
      <h4 className="text-sm font-bold mb-3">{title}</h4>
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/components/Dashboard.jsx && git commit -m "feat: Dashboard with KPI comparison arrows, streak KPIs, trend charts, collapsible analysis tables"
```

---

### Task 17: Update App.jsx — split trades state, integrate filter + pagination

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Add imports**

After line 12 (`import ExportBar from './components/ExportBar'`), add:
```javascript
import TradeFilter from './components/TradeFilter'
```

- [ ] **Step 2: Replace trades state and add filter/pagination state**

Replace line 30:
```javascript
  const [trades, setTrades] = useState([])
```
with:
```javascript
  const [allTrades, setAllTrades] = useState([])
  const [pagedTrades, setPagedTrades] = useState([])
  const [tradePagination, setTradePagination] = useState({ total: 0, limit: 20, offset: 0 })
  const [tradeFilter, setTradeFilter] = useState({ date_from: null, date_to: null, pair: null, direction: null })
```

- [ ] **Step 3: Add fetchPagedTrades helper and update reloadData**

Replace lines 67-71:
```javascript
  const reloadData = useCallback(() => {
    return Promise.all([api.getTrades(), api.getNotes(), api.getMonthlyNotes(), api.getPairs(), api.getPolicies()])
      .then(([t, n, mn, p, pol]) => { setTrades(t); setNotes(n); setMonthlyNotes(mn); setPairs(p); setPolicies(pol) })
      .catch(console.error)
  }, [])
```
with:
```javascript
  const fetchPagedTrades = useCallback((filter, offset = 0) => {
    const params = { limit: 20, offset, sort: 'open_time', order: 'desc' }
    if (filter.date_from) params.date_from = filter.date_from
    if (filter.date_to) params.date_to = filter.date_to
    if (filter.pair) params.pair = filter.pair
    if (filter.direction) params.direction = filter.direction
    return api.getTrades(params).then(result => {
      setPagedTrades(result.trades)
      setTradePagination({ total: result.total, limit: result.limit, offset: result.offset })
    })
  }, [])

  const reloadData = useCallback(() => {
    return Promise.all([
      api.getTrades(),
      api.getNotes(), api.getMonthlyNotes(), api.getPairs(), api.getPolicies()
    ]).then(([allResult, n, mn, p, pol]) => {
      setAllTrades(allResult.trades)
      setNotes(n); setMonthlyNotes(mn); setPairs(p); setPolicies(pol)
    }).catch(console.error)
  }, [])
```

- [ ] **Step 4: Update useEffect to also load paged trades**

Replace lines 73-77:
```javascript
  useEffect(() => {
    if (!authUser) return
    setLoading(true)
    reloadData().finally(() => setLoading(false))
  }, [authUser, reloadData])
```
with:
```javascript
  useEffect(() => {
    if (!authUser) return
    setLoading(true)
    Promise.all([reloadData(), fetchPagedTrades(tradeFilter)]).finally(() => setLoading(false))
  }, [authUser, reloadData, fetchPagedTrades])
```

- [ ] **Step 5: Add filter change handler**

After the logout handler (after line 97), add:
```javascript
  const handleFilterChange = useCallback((newFilter) => {
    setTradeFilter(newFilter)
    fetchPagedTrades(newFilter, 0)
  }, [fetchPagedTrades])

  const handlePageChange = useCallback((newOffset) => {
    fetchPagedTrades(tradeFilter, newOffset)
  }, [tradeFilter, fetchPagedTrades])
```

- [ ] **Step 6: Update derived data to use allTrades**

Replace line 100-101:
```javascript
  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades])
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed'), [trades])
```
with:
```javascript
  const openTrades = useMemo(() => allTrades.filter(t => t.status === 'open'), [allTrades])
  const closedTrades = useMemo(() => allTrades.filter(t => t.status === 'closed'), [allTrades])
```

- [ ] **Step 7: Update CRUD handlers to refresh both trade sets**

In `handleAddTrade` (around line 110-131), after setting form state, add reload calls. Replace the success path:

Find:
```javascript
      setShowForm(false)
      setEditViolations([])
      toast.success(editing ? '交易已更新' : '交易已记录')
```
Replace with:
```javascript
      setShowForm(false)
      setEditViolations([])
      reloadData()
      fetchPagedTrades(tradeFilter, tradePagination.offset)
      toast.success(editing ? '交易已更新' : '交易已记录')
```

Similarly in `handleCloseSubmit`, after `setClosingId(null)`:
```javascript
      reloadData()
      fetchPagedTrades(tradeFilter, tradePagination.offset)
```

In `handleDeleteTrade`, replace:
```javascript
      setTrades(prev => prev.filter(t => t.id !== id))
```
with:
```javascript
      reloadData()
      fetchPagedTrades(tradeFilter, tradePagination.offset)
```

In `handleAddMissed`, replace:
```javascript
      setTrades(prev => [...prev, created])
```
with:
```javascript
      reloadData()
      fetchPagedTrades(tradeFilter, tradePagination.offset)
```

- [ ] **Step 8: Update formInitial to use allTrades**

Replace lines 274-278 (the formInitial computation):
```javascript
  const formInitial = closingId
    ? trades.find(t => t.id === closingId)
    : editing
      ? trades.find(t => t.id === editing)
      : emptyTrade(pairNames)
```
with:
```javascript
  const formInitial = closingId
    ? allTrades.find(t => t.id === closingId)
    : editing
      ? allTrades.find(t => t.id === editing)
      : emptyTrade(pairNames)
```

- [ ] **Step 9: Update record tab rendering — add TradeFilter, pass pagination**

In the desktop record tab (around line 371-404), add TradeFilter before ExportBar and update TradeTable props:

Replace:
```javascript
          <div>
            <ExportBar onImported={reloadData} />
            <PsychologyPanel
```
with:
```javascript
          <div>
            <TradeFilter filter={tradeFilter} onChange={handleFilterChange} pairs={pairNames} />
            <ExportBar onImported={reloadData} />
            <PsychologyPanel
              trades={allTrades}
```

Replace the desktop TradeTable:
```javascript
            <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} />
```
with:
```javascript
            <TradeTable trades={pagedTrades.filter(t => t.status === 'closed')} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} pagination={tradePagination} onPageChange={handlePageChange} />
```

- [ ] **Step 10: Update mobile record tab similarly**

In the mobile tab content (around lines 326-338), add TradeFilter and update props:

Replace:
```javascript
      case 'record': return (
        <div>
          <PsychologyPanel
            trades={trades}
```
with:
```javascript
      case 'record': return (
        <div>
          <TradeFilter filter={tradeFilter} onChange={handleFilterChange} pairs={pairNames} />
          <PsychologyPanel
            trades={allTrades}
```

Replace the mobile TradeTable:
```javascript
          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} />
```
with:
```javascript
          <TradeTable trades={pagedTrades.filter(t => t.status === 'closed')} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} pagination={tradePagination} onPageChange={handlePageChange} />
```

- [ ] **Step 11: Update Dashboard to receive allTrades**

Replace desktop stats rendering:
```javascript
        {tab === "stats" && <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />}
```
This already uses `closedTrades` which is derived from `allTrades`, so it stays correct.

Similarly the mobile stats tab:
```javascript
      case 'stats': return <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />
```
Also correct.

- [ ] **Step 12: Update logout handler to clear new state**

In `handleLogout`, replace:
```javascript
    setTrades([])
```
with:
```javascript
    setAllTrades([])
    setPagedTrades([])
    setTradePagination({ total: 0, limit: 20, offset: 0 })
    setTradeFilter({ date_from: null, date_to: null, pair: null, direction: null })
```

- [ ] **Step 13: Commit**

```bash
cd /home/lz/workspace/trading-journal && git add client/src/App.jsx && git commit -m "feat: App.jsx splits trades into allTrades/pagedTrades, integrates filter + pagination"
```

---

### Task 18: Update ExportBar — field name

**Files:**
- Modify: `client/src/components/ExportBar.jsx`

- [ ] **Step 1: No functional changes needed**

The ExportBar uses `from` and `to` params which the server export route already handles (updated in Task 3). No changes required to this file — the export route now uses `open_time` internally.

- [ ] **Step 2: Verify by reading the file**

Confirm ExportBar doesn't reference `t.date` anywhere (it doesn't — it only passes date range params).

---

### Task 19: End-to-end verification

- [ ] **Step 1: Start the dev server**

Run: `cd /home/lz/workspace/trading-journal && npm run dev`
Expected: Both client (:3000) and server (:3001) start without errors

- [ ] **Step 2: Verify database migration**

Check that the migration ran by looking at the server startup logs. If the DB already has data, verify trades now have `open_time` field.

- [ ] **Step 3: Test trade CRUD**

1. Open the app at `http://localhost:3000`
2. Create a new open trade — verify `open_time` has datetime-local picker
3. Close the trade — verify `close_time` field appears with datetime-local picker
4. Edit a closed trade — verify both time fields display correctly

- [ ] **Step 4: Test filtering**

1. Click "今天" — verify table shows only today's trades
2. Click "本周" — verify table shows this week's trades
3. Select a specific pair from the dropdown — verify filtering works
4. Click "全部" — verify all trades return

- [ ] **Step 5: Test pagination**

1. If enough trades exist (>20), verify pagination controls appear
2. Click page 2 — verify different trades load
3. Verify "共 X 笔交易" count is correct

- [ ] **Step 6: Test Dashboard**

1. Switch to stats tab
2. Verify KPI cards show comparison arrows (if this week and last week have trades)
3. Verify streak KPI row appears (current streak, max win streak, max drawdown)
4. Verify weekly trend charts render (win rate line + PnL bar)
5. Verify cross-analysis tables are collapsible
6. Verify R-multiple shows `—` for trades without risk data

- [ ] **Step 7: Test OpenPositions**

1. Open a new position
2. Verify hold duration is displayed (e.g., "0小时5分钟")

- [ ] **Step 8: Final commit**

```bash
cd /home/lz/workspace/trading-journal && git add -A && git status
```

Review any uncommitted changes and commit if needed.
