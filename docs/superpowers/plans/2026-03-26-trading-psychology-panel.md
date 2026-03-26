# Trading Psychology Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a psychology panel to the record tab with stop-loss cost reframing ("lottery ticket" metaphor), missed trade recording, and real-time win rate display.

**Architecture:** Extend the existing `trades` table with a `risk_amount` field and `missed` status value. Add a new `PsychologyPanel` component to the record tab. Modify server validation to branch by status. No new API routes needed — reuse existing trades CRUD.

**Tech Stack:** React 19, Express 5, better-sqlite3, Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/db.js` | Modify (line ~199) | Add `risk_amount` column migration |
| `server/routes/trades.js` | Modify (lines 25–41, 53–72) | Branch validation by status, add `risk_amount` to INSERT/UPDATE |
| `server/index.js` | Modify (lines 94–99) | Add `risk_amount` to import INSERT |
| `client/src/lib/calc.js` | Modify (line 34) | Filter out `missed` trades in `calcStats()` |
| `client/src/components/TradeForm.jsx` | Modify (lines 14–17, 109–112) | Add `risk_amount` field in open-only mode |
| `client/src/components/PsychologyPanel.jsx` | Create | New panel component with 3 KPIs + missed trade form |
| `client/src/App.jsx` | Modify (lines 93–95, 294–321) | Add `missedTrades` derived state, render PsychologyPanel |

---

### Task 1: Database Migration — Add `risk_amount` Column

**Files:**
- Modify: `server/db.js:195-199` (after existing migrations)

- [ ] **Step 1: Add migration code**

Append after line 199 in `server/db.js`:

```js
// Migration: add risk_amount column to trades
const tradeColsRisk = db.prepare("PRAGMA table_info(trades)").all()
if (!tradeColsRisk.some(c => c.name === 'risk_amount')) {
  db.exec("ALTER TABLE trades ADD COLUMN risk_amount REAL DEFAULT NULL")
}
```

- [ ] **Step 2: Verify migration**

Run: `node -e "import('./server/db.js').then(() => console.log('OK'))"`
Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add risk_amount column migration to trades table"
```

---

### Task 2: Server — Update Trades Route Validation and SQL

**Files:**
- Modify: `server/routes/trades.js:22-47` (POST handler)
- Modify: `server/routes/trades.js:49-79` (PUT handler)

- [ ] **Step 1: Update POST route — extract `risk_amount`, branch validation, update INSERT**

Replace the POST handler (lines 22–47) with:

```js
// POST /api/trades - create trade (open, closed, or missed)
router.post('/', (req, res) => {
  try {
    const userId = req.session.userId
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
    const tradeStatus = status || 'open'
    const tradeDate = date || new Date().toISOString().split('T')[0]
    const tradeStrategy = strategy || '趋势跟踪'
    const tradeTimeframe = timeframe || 'H4'

    if (tradeStatus === 'missed') {
      // Missed trades only require date, pair, direction
      if (!pair || !direction) {
        return res.status(400).json({ error: 'Missing required fields: pair, direction' })
      }
    } else {
      if (!pair || !direction || entry == null || stop == null) {
        return res.status(400).json({ error: 'Missing required fields: pair, direction, entry, stop' })
      }
      if (tradeStatus === 'closed' && (exit_price == null || gross_pnl == null)) {
        return res.status(400).json({ error: 'Closed trades require exit_price and gross_pnl' })
      }
    }
    const stmt = db.prepare(`
      INSERT INTO trades (user_id, date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(userId, tradeDate, pair, direction, tradeStrategy, tradeTimeframe, lots || null, entry ?? null, stop ?? null, target || null, exit_price ?? null, gross_pnl ?? null, swap || 0, score || null, emotion || null, notes || null, tradeStatus, risk_amount ?? null)
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 2: Update PUT route — add `risk_amount`, block missed↔open/closed transitions**

Replace the PUT handler (lines 49–79) with:

```js
// PUT /api/trades/:id - update trade (close or edit)
router.put('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount } = req.body
    const existing = db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    if (!existing) return res.status(404).json({ error: 'Trade not found' })

    const tradeStatus = status || existing.status
    // Block status transitions between missed and open/closed
    if ((existing.status === 'missed' && tradeStatus !== 'missed') ||
        (existing.status !== 'missed' && tradeStatus === 'missed')) {
      return res.status(400).json({ error: 'Cannot convert between missed and open/closed status' })
    }
    if (tradeStatus === 'closed' && (exit_price == null || gross_pnl == null)) {
      return res.status(400).json({ error: 'Closed trades require exit_price and gross_pnl' })
    }

    const stmt = db.prepare(`
      UPDATE trades SET date=?, pair=?, direction=?, strategy=?, timeframe=?, lots=?, entry=?, stop=?, target=?, exit_price=?, gross_pnl=?, swap=?, score=?, emotion=?, notes=?, status=?, risk_amount=?, updated_at=datetime('now')
      WHERE id=? AND user_id=?
    `)
    stmt.run(
      date ?? existing.date, pair ?? existing.pair, direction ?? existing.direction,
      strategy ?? existing.strategy, timeframe ?? existing.timeframe, lots || existing.lots,
      entry ?? existing.entry, stop ?? existing.stop, target || existing.target,
      exit_price ?? null, gross_pnl ?? null, swap || 0,
      score || null, emotion || null, notes || null,
      tradeStatus, risk_amount ?? existing.risk_amount, req.params.id, userId
    )
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
    res.json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 3: Verify server starts**

Run: `cd server && node -e "import('./db.js').then(() => console.log('DB OK'))" && cd ..`
Expected: `DB OK`

- [ ] **Step 4: Commit**

```bash
git add server/routes/trades.js
git commit -m "feat: branch trade validation by status, add risk_amount to INSERT/UPDATE"
```

---

### Task 3: Server — Update Import Route

**Files:**
- Modify: `server/index.js:94-99` (import INSERT statement)

- [ ] **Step 1: Update import INSERT to include `risk_amount`**

Replace the import trades INSERT (lines 94–99) with:

```js
        const stmt = db.prepare(`
          INSERT INTO trades (user_id, date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const t of trades) {
          stmt.run(userId, t.date, t.pair, t.direction, t.strategy, t.timeframe, t.lots ?? null, t.entry ?? null, t.stop ?? null, t.target ?? null, t.exit_price ?? null, t.gross_pnl ?? null, t.swap ?? 0, t.score ?? null, t.emotion ?? null, t.notes ?? null, t.status || 'closed', t.risk_amount ?? null, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString())
          result.trades++
        }
```

Note: `entry` and `stop` changed from `t.entry` to `t.entry ?? null` to support importing `missed` trades where these fields are NULL.

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: add risk_amount to import INSERT, support missed trade imports"
```

---

### Task 4: Client — Filter Missed Trades in calcStats

**Files:**
- Modify: `client/src/lib/calc.js:34`

- [ ] **Step 1: Add explicit missed filter**

At line 34, change:

```js
export function calcStats(trades, spreadCostMap) {
  const computed = trades.map(t => calcTrade(t, spreadCostMap))
```

To:

```js
export function calcStats(trades, spreadCostMap) {
  const activeTrades = trades.filter(t => t.status !== 'missed')
  const computed = activeTrades.map(t => calcTrade(t, spreadCostMap))
```

- [ ] **Step 2: Verify build**

Run: `cd client && npx vite build 2>&1 | tail -5`
Expected: build completes without errors

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/calc.js
git commit -m "feat: explicitly filter missed trades from calcStats"
```

---

### Task 5: Client — Add `risk_amount` Field to TradeForm

**Files:**
- Modify: `client/src/components/TradeForm.jsx:14-17` (emptyTrade)
- Modify: `client/src/components/TradeForm.jsx:109-112` (form fields)

- [ ] **Step 1: Add `risk_amount` to emptyTrade**

At line 12–17, change `emptyTrade` to include `risk_amount`:

```js
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

- [ ] **Step 2: Add risk_amount input field after stop price (line 111)**

Add the risk_amount field after the `<Field label="目标价">` block (line 112), before the closing `</>` on line 113. Only shows in open-only mode:

```jsx
            {hideExit && (
              <Field label="本单风险($)"><Input value={form.risk_amount} onChange={uf("risk_amount")} placeholder="如: 150" /></Field>
            )}
```

- [ ] **Step 3: Verify build**

Run: `cd client && npx vite build 2>&1 | tail -5`
Expected: build completes without errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/TradeForm.jsx
git commit -m "feat: add risk_amount field to trade form in open-only mode"
```

---

### Task 6: Client — Create PsychologyPanel Component

**Files:**
- Create: `client/src/components/PsychologyPanel.jsx`

- [ ] **Step 1: Create the PsychologyPanel component**

Create `client/src/components/PsychologyPanel.jsx`:

```jsx
import { useState, useMemo } from 'react'
import KpiCard from './ui/KpiCard'
import Select from './ui/Select'
import Input from './ui/Input'
import { DIRECTIONS } from '../lib/constants'
import { calcStats } from '../lib/calc'

const today = () => new Date().toISOString().split("T")[0]

export default function PsychologyPanel({ trades, pairs, spreadCostMap, onAddMissed, onDeleteTrade }) {
  const [showMissedForm, setShowMissedForm] = useState(false)
  const [showMissedList, setShowMissedList] = useState(false)
  const [missedForm, setMissedForm] = useState({ date: today(), pair: pairs[0] || '', direction: '多(Buy)', notes: '' })

  const todayStr = today()

  // Today's open trades with risk_amount
  const todayOpenTrades = useMemo(() =>
    trades.filter(t => t.status === 'open' && t.date === todayStr),
    [trades, todayStr]
  )
  const todayRiskTotal = useMemo(() =>
    todayOpenTrades.reduce((sum, t) => sum + (parseFloat(t.risk_amount) || 0), 0),
    [todayOpenTrades]
  )
  const todayTickets = todayOpenTrades.filter(t => parseFloat(t.risk_amount) > 0).length

  // Win rate from closed trades
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed'), [trades])
  const stats = useMemo(() => calcStats(closedTrades, spreadCostMap), [closedTrades, spreadCostMap])
  const winRate = stats ? stats.winRate : 0
  const totalClosed = stats ? stats.total : 0

  // Today's missed trades
  const todayMissed = useMemo(() =>
    trades.filter(t => t.status === 'missed' && t.date === todayStr),
    [trades, todayStr]
  )

  const handleSubmitMissed = () => {
    if (!missedForm.pair || !missedForm.direction) return
    onAddMissed({
      date: missedForm.date || todayStr,
      pair: missedForm.pair,
      direction: missedForm.direction,
      notes: missedForm.notes,
      status: 'missed'
    })
    setMissedForm({ date: today(), pair: pairs[0] || '', direction: '多(Buy)', notes: '' })
    setShowMissedForm(false)
  }

  return (
    <div className="mb-5">
      {/* KPI Cards */}
      <div className="flex gap-3 flex-wrap mb-3">
        <KpiCard
          label="今日成本"
          value={`$${Math.round(todayRiskTotal)}`}
          color="#3b82f6"
          sub={todayTickets > 0 ? `${todayTickets} 张彩票` : '暂无开仓'}
        />
        <KpiCard
          label="历史胜率"
          value={totalClosed > 0 ? `${winRate}%` : '--'}
          color="#22c55e"
          sub={totalClosed > 0 ? `基于 ${totalClosed} 笔交易` : '暂无数据'}
        />
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex-1 min-w-[140px] shadow-sm
          hover:border-accent/30 transition-all duration-300 relative">
          <button
            onClick={() => { setShowMissedForm(v => !v); setShowMissedList(false) }}
            className="absolute top-2.5 right-3 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center
              cursor-pointer text-amber-500 font-bold text-sm hover:bg-amber-500/30 transition-colors"
            title="记录踏空"
          >+</button>
          <div className="text-[11px] text-muted tracking-wide uppercase mb-1">今日踏空</div>
          <div
            className="text-2xl font-bold font-mono cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: '#eab308' }}
            onClick={() => { if (todayMissed.length > 0) setShowMissedList(v => !v) }}
            title={todayMissed.length > 0 ? '点击查看踏空记录' : ''}
          >
            {todayMissed.length}
          </div>
          <div className="text-[10px] text-muted mt-1">与你无关的利润</div>
        </div>
      </div>

      {/* Missed trade form */}
      {showMissedForm && (
        <div className="p-3 bg-card border border-dashed border-amber-500/30 rounded-xl mb-3">
          <div className="text-xs font-semibold mb-2 text-amber-500">记录踏空</div>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="min-w-[110px]">
              <div className="text-[11px] text-muted mb-1">日期</div>
              <Input type="date" value={missedForm.date} onChange={v => setMissedForm(f => ({ ...f, date: v }))} />
            </div>
            <div className="min-w-[100px]">
              <div className="text-[11px] text-muted mb-1">品种</div>
              <Select value={missedForm.pair} onChange={v => setMissedForm(f => ({ ...f, pair: v }))} options={pairs} />
            </div>
            <div className="min-w-[90px]">
              <div className="text-[11px] text-muted mb-1">方向</div>
              <Select value={missedForm.direction} onChange={v => setMissedForm(f => ({ ...f, direction: v }))} options={DIRECTIONS} />
            </div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-[11px] text-muted mb-1">备注</div>
              <Input value={missedForm.notes} onChange={v => setMissedForm(f => ({ ...f, notes: v }))} placeholder="为什么没入场..." />
            </div>
            <button
              onClick={handleSubmitMissed}
              className="bg-amber-500/20 text-amber-500 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer
                hover:bg-amber-500/30 transition-colors whitespace-nowrap"
            >记录</button>
            <button
              onClick={() => setShowMissedForm(false)}
              className="text-muted px-3 py-2 rounded-lg text-sm cursor-pointer hover:text-text transition-colors"
            >取消</button>
          </div>
        </div>
      )}

      {/* Missed trade list */}
      {showMissedList && todayMissed.length > 0 && (
        <div className="p-3 bg-card border border-border rounded-xl mb-3">
          <div className="text-xs font-semibold mb-2 text-amber-500">今日踏空记录</div>
          <div className="space-y-1.5">
            {todayMissed.map(t => (
              <div key={t.id} className="flex items-center gap-3 text-sm py-1">
                <span className="font-medium">{t.pair}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  t.direction.startsWith('多') ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                }`}>{t.direction.startsWith('多') ? '多' : '空'}</span>
                {t.notes && <span className="text-muted text-xs flex-1 truncate">{t.notes}</span>}
                <button
                  onClick={() => onDeleteTrade(t.id)}
                  className="text-muted hover:text-red text-xs cursor-pointer transition-colors ml-auto"
                >删除</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd client && npx vite build 2>&1 | tail -5`
Expected: build completes without errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PsychologyPanel.jsx
git commit -m "feat: create PsychologyPanel component with KPIs and missed trade form"
```

---

### Task 7: Client — Integrate PsychologyPanel into App.jsx

**Files:**
- Modify: `client/src/App.jsx:1-18` (imports)
- Modify: `client/src/App.jsx:93-95` (derived data)
- Modify: `client/src/App.jsx:104-124` (handleAddTrade)
- Modify: `client/src/App.jsx:257-261` (mobile record tab)
- Modify: `client/src/App.jsx:294-321` (desktop record tab)

- [ ] **Step 1: Add import**

After line 10 (`import OpenPositions`), add:

```js
import PsychologyPanel from './components/PsychologyPanel'
```

- [ ] **Step 2: Add handleAddMissed handler**

After `handleNewTrade` (line 180), add:

```js
  const handleAddMissed = useCallback(async (form) => {
    try {
      const created = await api.createTrade(form)
      setTrades(prev => [...prev, created])
    } catch (err) {
      console.error(err)
    }
  }, [])
```

- [ ] **Step 3: Add PsychologyPanel to desktop record tab**

In the desktop record tab (line 294–321), add PsychologyPanel right after `<ExportBar>` (line 296):

```jsx
          <PsychologyPanel
            trades={trades}
            pairs={pairNames}
            spreadCostMap={spreadCostMap}
            onAddMissed={handleAddMissed}
            onDeleteTrade={handleDeleteTrade}
          />
```

- [ ] **Step 4: Add PsychologyPanel to mobile record tab**

In the mobile record tab (line 257–261), add PsychologyPanel at the top of the `<div>`:

```jsx
      case 'record': return (
        <div>
          <PsychologyPanel
            trades={trades}
            pairs={pairNames}
            spreadCostMap={spreadCostMap}
            onAddMissed={handleAddMissed}
            onDeleteTrade={handleDeleteTrade}
          />
          <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />
          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} spreadCostMap={spreadCostMap} />
        </div>
      )
```

- [ ] **Step 5: Verify build**

Run: `cd client && npx vite build 2>&1 | tail -5`
Expected: build completes without errors

- [ ] **Step 6: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: integrate PsychologyPanel into record tab (desktop + mobile)"
```

---

### Task 8: Manual Smoke Test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify psychology panel renders**

Open http://localhost:3000, navigate to record tab. Confirm:
- 3 KPI cards visible (今日成本, 历史胜率, 今日踏空)
- 今日成本 shows $0 / 暂无开仓
- 历史胜率 shows real win rate from existing trades
- 今日踏空 shows 0

- [ ] **Step 3: Test missed trade recording**

Click "+" on 踏空 card → fill form → click 记录. Confirm:
- 踏空 count increments to 1
- Click the number → missed trade list appears
- Can delete the missed record

- [ ] **Step 4: Test open trade with risk_amount**

Click "+ 记录交易" → toggle "仅开仓" → fill entry/stop + "本单风险($)" → submit. Confirm:
- Trade appears in open positions
- 今日成本 updates with the risk amount
- 彩票 count increments

- [ ] **Step 5: Test existing functionality unchanged**

- Close an open trade → verify it works
- Edit a closed trade → verify it works
- Check stats dashboard → verify no missed trades appear in stats

- [ ] **Step 6: Commit final state if all passes**

```bash
git add -A
git commit -m "feat: trading psychology panel — stop-loss cost reframing and missed trade recording"
```
