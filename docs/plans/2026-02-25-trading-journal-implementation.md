# Trading Journal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack trading journal web app with React frontend, Express backend, SQLite database, and Docker deployment.

**Architecture:** Vite-powered React frontend with Tailwind CSS dark theme communicates with an Express.js REST API backed by SQLite via better-sqlite3. In production, Express serves the built frontend as static files from a single Docker container.

**Tech Stack:** React 18, Vite, Tailwind CSS 3, recharts, Express.js, better-sqlite3, Docker

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `package.json`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/index.css`
- Create: `server/package.json`
- Create: `.gitignore`

**Step 1: Initialize root package.json**

```json
{
  "name": "trading-journal",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "cd client && npm run dev",
    "dev:server": "cd server && node --watch index.js",
    "build": "cd client && npm run build",
    "start": "cd server && node index.js",
    "install:all": "npm install && cd client && npm install && cd ../server && npm install"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

**Step 2: Initialize client/package.json and install frontend deps**

```json
{
  "name": "trading-journal-client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Run:
```bash
cd client
npm install react react-dom recharts
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite postcss autoprefixer
```

**Step 3: Create client/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true
  }
})
```

**Step 4: Create client/tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e17',
        card: '#111827',
        border: '#1e293b',
        accent: '#3b82f6',
        green: '#10b981',
        red: '#ef4444',
        gold: '#f59e0b',
        purple: '#8b5cf6',
        text: '#e2e8f0',
        muted: '#64748b',
        input: '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  },
  plugins: []
}
```

**Step 5: Create client/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}
```

**Step 6: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trading Journal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body class="bg-bg text-text min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**Step 7: Create client/src/index.css**

```css
@import "tailwindcss";
```

**Step 8: Create client/src/main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

**Step 9: Create minimal client/src/App.jsx placeholder**

```jsx
export default function App() {
  return <div className="p-8 text-text">Trading Journal - Loading...</div>
}
```

**Step 10: Initialize server/package.json and install backend deps**

```json
{
  "name": "trading-journal-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  }
}
```

Run:
```bash
cd server
npm install express better-sqlite3 cors
```

**Step 11: Create .gitignore**

```
node_modules/
data/*.db
server/public/
dist/
.env
*.log
```

**Step 12: Verify frontend boots**

Run: `cd client && npx vite --port 3000`
Expected: Vite dev server starts, page shows "Trading Journal - Loading..."

**Step 13: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project with Vite, Express, Tailwind"
```

---

### Task 2: Backend - Database & Express Server

**Files:**
- Create: `server/db.js`
- Create: `server/index.js`

**Step 1: Create server/db.js**

```js
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
    exit_price REAL NOT NULL,
    gross_pnl REAL NOT NULL,
    swap REAL DEFAULT 0,
    score TEXT,
    emotion TEXT,
    notes TEXT,
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
`)

export default db
```

**Step 2: Create server/index.js**

```js
import express from 'express'
import cors from 'cors'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import tradesRouter from './routes/trades.js'
import notesRouter from './routes/notes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/trades', tradesRouter)
app.use('/api/notes', notesRouter)

// Serve frontend in production
const publicDir = join(__dirname, 'public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.get('*', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
```

**Step 3: Commit**

```bash
git add server/db.js server/index.js
git commit -m "feat: add Express server with SQLite database initialization"
```

---

### Task 3: Backend - Trades API Routes

**Files:**
- Create: `server/routes/trades.js`

**Step 1: Create server/routes/trades.js**

```js
import { Router } from 'express'
import db from '../db.js'

const router = Router()

// GET /api/trades - list all trades
router.get('/', (req, res) => {
  try {
    const sort = req.query.sort || 'date'
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC'
    const allowed = ['id', 'date', 'pair', 'gross_pnl', 'created_at']
    const sortCol = allowed.includes(sort) ? sort : 'date'
    const trades = db.prepare(`SELECT * FROM trades ORDER BY ${sortCol} ${order}, id ${order}`).all()
    res.json(trades)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trades - create trade
router.post('/', (req, res) => {
  try {
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes } = req.body
    if (!date || !pair || !direction || !strategy || !timeframe || entry == null || stop == null || exit_price == null || gross_pnl == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const stmt = db.prepare(`
      INSERT INTO trades (date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(date, pair, direction, strategy, timeframe, lots || null, entry, stop, target || null, exit_price, gross_pnl, swap || 0, score || null, emotion || null, notes || null)
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/trades/:id - update trade
router.put('/:id', (req, res) => {
  try {
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes } = req.body
    const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Trade not found' })

    const stmt = db.prepare(`
      UPDATE trades SET date=?, pair=?, direction=?, strategy=?, timeframe=?, lots=?, entry=?, stop=?, target=?, exit_price=?, gross_pnl=?, swap=?, score=?, emotion=?, notes=?, updated_at=datetime('now')
      WHERE id=?
    `)
    stmt.run(date, pair, direction, strategy, timeframe, lots || null, entry, stop, target || null, exit_price, gross_pnl, swap || 0, score || null, emotion || null, notes || null, req.params.id)
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
    res.json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/trades/:id - delete trade
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Trade not found' })
    db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
```

**Step 2: Verify API works**

Run: `cd server && node index.js`

Test with curl:
```bash
# Create a trade
curl -X POST http://localhost:3001/api/trades -H "Content-Type: application/json" -d '{"date":"2026-02-25","pair":"EUR/USD","direction":"多(Buy)","strategy":"趋势跟踪","timeframe":"H4","lots":0.1,"entry":1.0325,"stop":1.0295,"exit_price":1.0372,"gross_pnl":235}'

# List trades
curl http://localhost:3001/api/trades
```

Expected: 201 response with trade object, then array with one trade.

**Step 3: Commit**

```bash
git add server/routes/trades.js
git commit -m "feat: add trades CRUD API routes"
```

---

### Task 4: Backend - Notes API & Export

**Files:**
- Create: `server/routes/notes.js`
- Modify: `server/index.js` (add export route)

**Step 1: Create server/routes/notes.js**

```js
import { Router } from 'express'
import db from '../db.js'

const router = Router()

// GET /api/notes - list all notes
router.get('/', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM weekly_notes ORDER BY created_at DESC').all()
    res.json(notes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notes - create note
router.post('/', (req, res) => {
  try {
    const { week, lesson, plan } = req.body
    if (!week) return res.status(400).json({ error: 'Week is required' })
    const stmt = db.prepare('INSERT INTO weekly_notes (week, lesson, plan) VALUES (?, ?, ?)')
    const result = stmt.run(week, lesson || null, plan || null)
    const note = db.prepare('SELECT * FROM weekly_notes WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(note)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/notes/:id - delete note
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM weekly_notes WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Note not found' })
    db.prepare('DELETE FROM weekly_notes WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
```

**Step 2: Add export route to server/index.js**

Add before the static file serving block:

```js
// Export all data as JSON
app.get('/api/export', (req, res) => {
  try {
    const trades = db.prepare('SELECT * FROM trades ORDER BY date DESC').all()
    const weeklyNotes = db.prepare('SELECT * FROM weekly_notes ORDER BY created_at DESC').all()
    const data = {
      exportDate: new Date().toISOString(),
      trades,
      weeklyNotes
    }
    res.setHeader('Content-Disposition', `attachment; filename="trading-journal-${new Date().toISOString().split('T')[0]}.json"`)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

Note: This requires importing `db` in server/index.js. Add at top:
```js
import db from './db.js'
```

**Step 3: Commit**

```bash
git add server/routes/notes.js server/index.js
git commit -m "feat: add notes API and JSON export endpoint"
```

---

### Task 5: Frontend - Constants & Calculation Logic

**Files:**
- Create: `client/src/lib/constants.js`
- Create: `client/src/lib/calc.js`

**Step 1: Create client/src/lib/constants.js**

Extract all constants from the original code:

```js
export const PAIRS = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","NZD/USD","USD/CAD","USD/CHF","EUR/GBP","EUR/JPY","GBP/JPY","AUD/JPY","XAU/USD","XAG/USD","USOil","UKOil","NGAS"]

export const DIRECTIONS = ["多(Buy)","空(Sell)"]

export const STRATEGIES = ["趋势跟踪","通道突破","回调入场","形态交易","均值回归","基本面驱动","技术+基本面","其他"]

export const TIMEFRAMES = ["M15","M30","H1","H4","D1","W1"]

export const SCORES = ["A-完美执行","B-基本执行","C-有偏差","D-严重违规"]

export const EMOTIONS = ["冷静理性","略有紧张","贪婪冲动","恐惧犹豫","报复心态","过度自信","犹豫不决"]

export const WEEKDAYS = ["周日","周一","周二","周三","周四","周五","周六"]

export const SPREAD_COST = {
  "EUR/USD": 3.5, "GBP/USD": 4, "USD/JPY": 3, "AUD/USD": 3.5,
  "NZD/USD": 4.5, "USD/CAD": 4, "USD/CHF": 4, "EUR/GBP": 4.5,
  "EUR/JPY": 5, "GBP/JPY": 6, "AUD/JPY": 5, "XAU/USD": 12,
  "XAG/USD": 10, "USOil": 5, "UKOil": 6, "NGAS": 8
}
```

**Step 2: Create client/src/lib/calc.js**

```js
import { SPREAD_COST, WEEKDAYS } from './constants'

const weekday = (d) => WEEKDAYS[new Date(d).getDay()]

export function calcTrade(t) {
  const entry = parseFloat(t.entry) || 0
  const stop = parseFloat(t.stop) || 0
  const exitPrice = parseFloat(t.exit_price) || 0
  const lots = parseFloat(t.lots) || 0
  const gross = parseFloat(t.gross_pnl) || 0
  const swap = parseFloat(t.swap) || 0
  const isBuy = t.direction.startsWith("多")

  const stopPips = Math.abs(entry - stop)
  const pnlPips = isBuy ? exitPrice - entry : entry - exitPrice
  const rMultiple = stopPips > 0 ? pnlPips / stopPips : 0
  const spread = (SPREAD_COST[t.pair] || 5) * lots
  const netPnl = gross - spread + swap

  return {
    ...t,
    weekday: weekday(t.date),
    stopPips,
    pnlPips,
    rMultiple: Math.round(rMultiple * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
  }
}

export function calcStats(trades) {
  const computed = trades.map(calcTrade)
  if (computed.length === 0) return null

  const wins = computed.filter(t => t.netPnl > 0)
  const losses = computed.filter(t => t.netPnl < 0)
  const totalNet = computed.reduce((s, t) => s + t.netPnl, 0)
  const totalGross = computed.reduce((s, t) => s + (parseFloat(t.gross_pnl) || 0), 0)
  const totalSpread = computed.reduce((s, t) => s + t.spread, 0)
  const totalSwap = computed.reduce((s, t) => s + (parseFloat(t.swap) || 0), 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length : 0

  const byPair = {}; const byStrat = {}; const byEmo = {}; const byDay = {}; const byTf = {}
  computed.forEach(t => {
    for (const [map, key] of [[byPair, t.pair],[byStrat, t.strategy],[byEmo, t.emotion],[byDay, t.weekday],[byTf, t.timeframe]]) {
      if (!map[key]) map[key] = { count: 0, wins: 0, totalPnl: 0, totalR: 0 }
      map[key].count++
      if (t.netPnl > 0) map[key].wins++
      map[key].totalPnl += t.netPnl
      map[key].totalR += t.rMultiple
    }
  })

  const toArr = (m) => Object.entries(m).map(([k, v]) => ({
    name: k, count: v.count,
    winRate: v.count ? Math.round(v.wins / v.count * 1000) / 10 : 0,
    pnl: Math.round(v.totalPnl * 100) / 100,
    avgR: v.count ? Math.round(v.totalR / v.count * 100) / 100 : 0
  }))

  let cumPnl = 0
  const cumData = computed.map((t, i) => { cumPnl += t.netPnl; return { idx: i + 1, pnl: Math.round(cumPnl * 100) / 100 } })

  return {
    total: computed.length, wins: wins.length, losses: losses.length,
    winRate: Math.round(wins.length / computed.length * 1000) / 10,
    totalNet: Math.round(totalNet * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    totalSpread: Math.round(totalSpread * 100) / 100,
    totalSwap: Math.round(totalSwap * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: avgLoss !== 0 ? Math.round(Math.abs(avgWin / avgLoss) * 100) / 100 : 0,
    avgR: Math.round(computed.reduce((s, t) => s + t.rMultiple, 0) / computed.length * 100) / 100,
    byPair: toArr(byPair).sort((a, b) => b.pnl - a.pnl),
    byStrat: toArr(byStrat).sort((a, b) => b.pnl - a.pnl),
    byEmo: toArr(byEmo).filter(x => x.count > 0),
    byDay: toArr(byDay),
    byTf: toArr(byTf).filter(x => x.count > 0),
    cumData,
    computed,
  }
}
```

**Step 3: Commit**

```bash
git add client/src/lib/
git commit -m "feat: extract constants and calculation logic into lib modules"
```

---

### Task 6: Frontend - API Hook

**Files:**
- Create: `client/src/hooks/useApi.js`

**Step 1: Create client/src/hooks/useApi.js**

```js
const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Trades
  getTrades: () => request('/trades'),
  createTrade: (data) => request('/trades', { method: 'POST', body: JSON.stringify(data) }),
  updateTrade: (id, data) => request(`/trades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTrade: (id) => request(`/trades/${id}`, { method: 'DELETE' }),

  // Notes
  getNotes: () => request('/notes'),
  createNote: (data) => request('/notes', { method: 'POST', body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  // Export
  exportData: async () => {
    const res = await fetch(`${BASE}/export`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  },
}
```

**Step 2: Commit**

```bash
git add client/src/hooks/useApi.js
git commit -m "feat: add API client hook for trades, notes, and export"
```

---

### Task 7: Frontend - UI Components

**Files:**
- Create: `client/src/components/ui/Input.jsx`
- Create: `client/src/components/ui/Select.jsx`
- Create: `client/src/components/ui/Tab.jsx`
- Create: `client/src/components/ui/KpiCard.jsx`

**Step 1: Create client/src/components/ui/Input.jsx**

```jsx
export default function Input({ value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm outline-none font-mono
        focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200
        placeholder:text-muted/50 ${className}`}
    />
  )
}
```

**Step 2: Create client/src/components/ui/Select.jsx**

```jsx
export default function Select({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm outline-none
        focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200
        cursor-pointer ${className}`}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
```

**Step 3: Create client/src/components/ui/Tab.jsx**

```jsx
export default function Tab({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-accent text-white shadow-lg shadow-accent/20'
          : 'text-muted hover:text-text hover:bg-white/5'
        }`}
    >
      {children}
    </button>
  )
}
```

**Step 4: Create client/src/components/ui/KpiCard.jsx**

```jsx
export default function KpiCard({ label, value, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex-1 min-w-[140px]
      hover:border-accent/30 transition-all duration-300">
      <div className="text-[11px] text-muted tracking-wide uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color || undefined }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add client/src/components/ui/
git commit -m "feat: add reusable UI components (Input, Select, Tab, KpiCard)"
```

---

### Task 8: Frontend - Layout Component

**Files:**
- Create: `client/src/components/Layout.jsx`

**Step 1: Create client/src/components/Layout.jsx**

```jsx
import Tab from './ui/Tab'

export default function Layout({ tab, setTab, tradeCount, onExport, children }) {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Fixed Header with frosted glass */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#0f172a]/90 to-[#1e1b4b]/90 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Trading Journal</h1>
            <p className="text-xs text-muted mt-0.5">
              Forex &middot; Metals &middot; Energy &nbsp;|&nbsp; {tradeCount} trades recorded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-card/80 rounded-xl p-1">
              <Tab active={tab === "record"} onClick={() => setTab("record")}>Records</Tab>
              <Tab active={tab === "stats"} onClick={() => setTab("stats")}>Dashboard</Tab>
              <Tab active={tab === "weekly"} onClick={() => setTab("weekly")}>Review</Tab>
            </div>
            <button
              onClick={onExport}
              className="ml-2 px-4 py-2 rounded-lg text-xs font-medium text-muted border border-border
                hover:text-text hover:border-accent/50 transition-all duration-200 cursor-pointer"
            >
              Export JSON
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: add Layout component with frosted glass header"
```

---

### Task 9: Frontend - TradeForm Component

**Files:**
- Create: `client/src/components/TradeForm.jsx`

**Step 1: Create client/src/components/TradeForm.jsx**

```jsx
import { useState } from 'react'
import Input from './ui/Input'
import Select from './ui/Select'
import { PAIRS, DIRECTIONS, STRATEGIES, TIMEFRAMES, SCORES, EMOTIONS } from '../lib/constants'
import { calcTrade } from '../lib/calc'

const today = () => new Date().toISOString().split("T")[0]

export function emptyTrade() {
  return {
    date: today(), pair: "EUR/USD", direction: "多(Buy)",
    strategy: "趋势跟踪", timeframe: "H4", lots: "", entry: "", stop: "", target: "",
    exit_price: "", gross_pnl: "", swap: "0", score: "B-基本执行", emotion: "冷静理性", notes: ""
  }
}

export default function TradeForm({ initial, editing, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial || emptyTrade())
  const uf = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.entry || !form.stop || !form.exit_price || !form.gross_pnl) return
    onSubmit(form)
  }

  const preview = (form.entry && form.stop && form.exit_price && form.gross_pnl) ? calcTrade(form) : null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 animate-in slide-in-from-top-2">
      <h3 className="text-base font-bold mb-5">
        {editing ? "Edit Trade" : "New Trade"}
      </h3>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        <Field label="Date"><Input type="date" value={form.date} onChange={uf("date")} /></Field>
        <Field label="Pair"><Select value={form.pair} onChange={uf("pair")} options={PAIRS} /></Field>
        <Field label="Direction"><Select value={form.direction} onChange={uf("direction")} options={DIRECTIONS} /></Field>
        <Field label="Strategy"><Select value={form.strategy} onChange={uf("strategy")} options={STRATEGIES} /></Field>
        <Field label="Timeframe"><Select value={form.timeframe} onChange={uf("timeframe")} options={TIMEFRAMES} /></Field>
        <Field label="Lots"><Input value={form.lots} onChange={uf("lots")} placeholder="0.1" /></Field>
        <Field label="Entry *"><Input value={form.entry} onChange={uf("entry")} placeholder="1.03250" /></Field>
        <Field label="Stop *"><Input value={form.stop} onChange={uf("stop")} placeholder="1.02950" /></Field>
        <Field label="Target"><Input value={form.target} onChange={uf("target")} placeholder="Optional" /></Field>
        <Field label="Exit *"><Input value={form.exit_price} onChange={uf("exit_price")} placeholder="1.03720" /></Field>
        <Field label="PnL (USD) *"><Input value={form.gross_pnl} onChange={uf("gross_pnl")} placeholder="235" /></Field>
        <Field label="Swap"><Input value={form.swap} onChange={uf("swap")} placeholder="0" /></Field>
        <Field label="Score"><Select value={form.score} onChange={uf("score")} options={SCORES} /></Field>
        <Field label="Emotion"><Select value={form.emotion} onChange={uf("emotion")} options={EMOTIONS} /></Field>
      </div>

      <div className="mt-4">
        <div className="text-[11px] text-muted mb-1">Notes</div>
        <textarea
          value={form.notes}
          onChange={e => uf("notes")(e.target.value)}
          placeholder="Entry logic, position management, exit reason..."
          className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[60px] resize-y outline-none
            focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
        />
      </div>

      {/* Auto-calc preview */}
      {preview && (
        <div className="mt-4 p-3 bg-bg rounded-lg flex gap-5 flex-wrap text-xs font-mono">
          <span className="text-muted">Auto-calc:</span>
          <span>Stop pips: <b>{preview.stopPips.toFixed(5)}</b></span>
          <span>PnL pips: <b className={preview.pnlPips >= 0 ? 'text-green' : 'text-red'}>{preview.pnlPips.toFixed(5)}</b></span>
          <span>R: <b className={preview.rMultiple >= 0 ? 'text-green' : 'text-red'}>{preview.rMultiple}R</b></span>
          <span>Spread: <b>${preview.spread}</b></span>
          <span>Net: <b className={preview.netPnl >= 0 ? 'text-green' : 'text-red'}>${preview.netPnl}</b></span>
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={handleSubmit}
          className="bg-green text-white px-7 py-2.5 rounded-lg text-sm font-semibold cursor-pointer
            hover:brightness-110 transition-all duration-200">
          {editing ? "Save Changes" : "Confirm"}
        </button>
        <button onClick={onCancel}
          className="text-muted border border-border px-5 py-2.5 rounded-lg text-sm cursor-pointer
            hover:text-text hover:border-muted transition-all duration-200">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] text-muted mb-1">{label}</div>
      {children}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add client/src/components/TradeForm.jsx
git commit -m "feat: add TradeForm component with auto-calc preview"
```

---

### Task 10: Frontend - TradeTable Component

**Files:**
- Create: `client/src/components/TradeTable.jsx`

**Step 1: Create client/src/components/TradeTable.jsx**

```jsx
import { calcTrade } from '../lib/calc'

const HEADERS = ["#", "Date", "Pair", "Dir", "Strategy", "TF", "Lots", "Entry", "Exit", "R", "Net PnL", "Score", "Emotion", ""]

export default function TradeTable({ trades, onEdit, onDelete }) {
  const computed = trades.map(calcTrade)

  if (computed.length === 0) {
    return (
      <div className="text-center py-20 text-muted">
        <div className="text-4xl mb-3 opacity-50">No trades yet</div>
        <p className="text-sm">Click the button above to record your first trade</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-border">
            {HEADERS.map(h => (
              <th key={h} className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...computed].reverse().map((t, i) => (
            <tr key={t.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors duration-150">
              <td className="px-3 py-3 text-muted">{computed.length - i}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                {t.date}
                <span className="block text-[10px] text-muted">{t.weekday}</span>
              </td>
              <td className="px-3 py-3 font-semibold">{t.pair}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold
                  ${t.direction.startsWith("多")
                    ? 'bg-green/10 text-green'
                    : 'bg-red/10 text-red'}`}>
                  {t.direction.startsWith("多") ? "BUY" : "SELL"}
                </span>
              </td>
              <td className="px-3 py-3 text-[11px]">{t.strategy}</td>
              <td className="px-3 py-3 text-[11px] text-muted">{t.timeframe}</td>
              <td className="px-3 py-3 font-mono">{t.lots}</td>
              <td className="px-3 py-3 font-mono text-[11px]">{t.entry}</td>
              <td className="px-3 py-3 font-mono text-[11px]">{t.exit_price}</td>
              <td className={`px-3 py-3 font-mono font-bold ${t.rMultiple >= 0 ? 'text-green' : 'text-red'}`}>
                {t.rMultiple > 0 ? "+" : ""}{t.rMultiple}R
              </td>
              <td className={`px-3 py-3 font-mono font-bold ${t.netPnl >= 0 ? 'text-green' : 'text-red'}`}>
                ${t.netPnl.toFixed(2)}
              </td>
              <td className="px-3 py-3 text-[10px]">{t.score?.split("-")[0]}</td>
              <td className="px-3 py-3 text-[10px]">{t.emotion}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <button onClick={() => onEdit(t)} className="text-accent hover:text-accent/80 cursor-pointer mr-2 transition-colors">
                  Edit
                </button>
                <button onClick={() => onDelete(t.id)} className="text-red hover:text-red/80 cursor-pointer transition-colors">
                  Del
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add client/src/components/TradeTable.jsx
git commit -m "feat: add TradeTable component with hover effects"
```

---

### Task 11: Frontend - Dashboard Component

**Files:**
- Create: `client/src/components/Dashboard.jsx`

**Step 1: Create client/src/components/Dashboard.jsx**

```jsx
import { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import KpiCard from './ui/KpiCard'
import { calcStats } from '../lib/calc'

const CHART_COLORS = ["#3b82f6","#10b981","#ef4444","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"]
const C = { card: '#111827', border: '#1e293b', muted: '#64748b', accent: '#3b82f6', green: '#10b981', red: '#ef4444', gold: '#f59e0b' }

const tooltipStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }

export default function Dashboard({ trades }) {
  const stats = useMemo(() => calcStats(trades), [trades])

  if (!stats) {
    return (
      <div className="text-center py-20 text-muted">
        <div className="text-4xl mb-3 opacity-50">No data</div>
        <p className="text-sm">Statistics will appear after you record trades</p>
      </div>
    )
  }

  const goodScoreRate = Math.round(
    stats.computed.filter(t => t.score?.startsWith("A") || t.score?.startsWith("B")).length / stats.computed.length * 100
  )

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="flex gap-3 flex-wrap">
        <KpiCard label="Total Trades" value={stats.total} />
        <KpiCard label="Win Rate" value={stats.winRate + "%"} color={stats.winRate >= 50 ? C.green : C.red} />
        <KpiCard label="Net PnL" value={"$" + stats.totalNet.toFixed(0)} color={stats.totalNet >= 0 ? C.green : C.red} />
        <KpiCard label="Profit Factor" value={stats.profitFactor} color={stats.profitFactor >= 1.5 ? C.green : C.gold} />
        <KpiCard label="Avg R" value={stats.avgR + "R"} color={stats.avgR >= 0 ? C.green : C.red} />
        <KpiCard label="Execution %" value={goodScoreRate + "%"} />
      </div>

      {/* Core + Cost cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Core Metrics">
          {[["Wins", stats.wins], ["Losses", stats.losses], ["Avg Win", "$" + stats.avgWin.toFixed(2)], ["Avg Loss", "$" + stats.avgLoss.toFixed(2)]].map(([k, v]) => (
            <StatRow key={k} label={k} value={v} />
          ))}
        </Card>
        <Card title="Cost Analysis">
          {[["Gross PnL", "$" + stats.totalGross.toFixed(2)], ["Spread Cost", "-$" + Math.abs(stats.totalSpread).toFixed(2)], ["Swap", (stats.totalSwap >= 0 ? "+$" : "-$") + Math.abs(stats.totalSwap).toFixed(2)], ["Net PnL", "$" + stats.totalNet.toFixed(2)]].map(([k, v]) => (
            <StatRow key={k} label={k} value={v} />
          ))}
        </Card>
      </div>

      {/* Cumulative PnL */}
      {stats.cumData.length > 1 && (
        <Card title="Cumulative Net PnL">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.cumData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="idx" stroke={C.muted} fontSize={10} />
              <YAxis stroke={C.muted} fontSize={10} tickFormatter={v => "$" + v} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => ["$" + v, "Cumulative PnL"]} />
              <Line type="monotone" dataKey="pnl" stroke={C.accent} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="PnL by Pair">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.byPair} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis type="number" stroke={C.muted} fontSize={10} tickFormatter={v => "$" + v} />
              <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={10} width={65} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => "$" + v} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {stats.byPair.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Emotion Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.byEmo} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {stats.byEmo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detail Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[["Strategy", stats.byStrat], ["Weekday", stats.byDay], ["Timeframe", stats.byTf], ["Emotion vs PnL", stats.byEmo]].map(([title, data]) => (
          <Card key={title} title={title}>
            <table className="w-full text-[11px]">
              <thead>
                <tr>{["Name","Count","Win%","PnL","Avg R"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-muted font-semibold border-b border-border text-[10px] uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.name} className="border-b border-border/30">
                    <td className="px-2 py-1.5 font-semibold">{d.name}</td>
                    <td className="px-2 py-1.5">{d.count}</td>
                    <td className={`px-2 py-1.5 ${d.winRate >= 50 ? 'text-green' : 'text-red'}`}>{d.winRate}%</td>
                    <td className={`px-2 py-1.5 font-mono ${d.pnl >= 0 ? 'text-green' : 'text-red'}`}>${d.pnl}</td>
                    <td className="px-2 py-1.5 font-mono">{d.avgR}R</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
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

**Step 2: Commit**

```bash
git add client/src/components/Dashboard.jsx
git commit -m "feat: add Dashboard component with KPIs and charts"
```

---

### Task 12: Frontend - WeeklyNotes Component

**Files:**
- Create: `client/src/components/WeeklyNotes.jsx`

**Step 1: Create client/src/components/WeeklyNotes.jsx**

```jsx
import { useState } from 'react'
import Input from './ui/Input'

export default function WeeklyNotes({ notes, onAdd, onDelete }) {
  const [form, setForm] = useState({ week: "", lesson: "", plan: "" })

  const add = () => {
    if (!form.week) return
    onAdd(form)
    setForm({ week: "", lesson: "", plan: "" })
  }

  return (
    <div>
      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h3 className="text-base font-bold mb-5">New Review Note</h3>
        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-muted mb-1">Week</div>
            <Input value={form.week} onChange={v => setForm(f => ({ ...f, week: v }))} placeholder="e.g. 2026-W08" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">Key Lessons</div>
            <textarea
              value={form.lesson}
              onChange={e => setForm(f => ({ ...f, lesson: e.target.value }))}
              placeholder="What was the biggest lesson this week?"
              className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y outline-none
                focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">Improvement Plan</div>
            <textarea
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              placeholder="What to improve next week?"
              className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[60px] resize-y outline-none
                focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
            />
          </div>
        </div>
        <button onClick={add}
          className="mt-4 bg-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer
            hover:brightness-110 transition-all duration-200">
          Save Note
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <div className="text-4xl mb-3 opacity-50">No reviews yet</div>
          <p className="text-sm">Spend 15 minutes each weekend to review - consistency is key</p>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} className="bg-card border border-border rounded-xl p-4 mb-3 hover:border-border/80 transition-all duration-200">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-sm">{n.week}</span>
              <button onClick={() => onDelete(n.id)}
                className="text-red text-xs cursor-pointer hover:text-red/80 transition-colors">
                Delete
              </button>
            </div>
            {n.lesson && (
              <div className="mb-2">
                <div className="text-[11px] text-gold font-semibold mb-1">Key Lessons</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{n.lesson}</div>
              </div>
            )}
            {n.plan && (
              <div>
                <div className="text-[11px] text-accent font-semibold mb-1">Improvement Plan</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{n.plan}</div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add client/src/components/WeeklyNotes.jsx
git commit -m "feat: add WeeklyNotes component"
```

---

### Task 13: Frontend - App.jsx (Wire Everything Together)

**Files:**
- Modify: `client/src/App.jsx`

**Step 1: Rewrite client/src/App.jsx**

```jsx
import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import TradeForm, { emptyTrade } from './components/TradeForm'
import TradeTable from './components/TradeTable'
import Dashboard from './components/Dashboard'
import WeeklyNotes from './components/WeeklyNotes'
import { api } from './hooks/useApi'

export default function App() {
  const [trades, setTrades] = useState([])
  const [notes, setNotes] = useState([])
  const [tab, setTab] = useState("record")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load data on mount
  useEffect(() => {
    Promise.all([api.getTrades(), api.getNotes()])
      .then(([t, n]) => { setTrades(t); setNotes(n) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Trade CRUD
  const handleAddTrade = useCallback(async (form) => {
    try {
      if (editing) {
        const updated = await api.updateTrade(editing, form)
        setTrades(prev => prev.map(t => t.id === editing ? updated : t))
        setEditing(null)
      } else {
        const created = await api.createTrade(form)
        setTrades(prev => [...prev, created])
      }
      setShowForm(false)
    } catch (err) {
      console.error(err)
    }
  }, [editing])

  const handleEditTrade = useCallback((trade) => {
    setEditing(trade.id)
    setShowForm(true)
    setTab("record")
  }, [])

  const handleDeleteTrade = useCallback(async (id) => {
    try {
      await api.deleteTrade(id)
      setTrades(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [])

  // Notes CRUD
  const handleAddNote = useCallback(async (form) => {
    try {
      const created = await api.createNote(form)
      setNotes(prev => [created, ...prev])
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleDeleteNote = useCallback(async (id) => {
    try {
      await api.deleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        Loading...
      </div>
    )
  }

  return (
    <Layout tab={tab} setTab={setTab} tradeCount={trades.length} onExport={api.exportData}>
      {/* Record Tab */}
      {tab === "record" && (
        <div>
          {!showForm && (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer
                hover:brightness-110 transition-all duration-200 mb-5">
              + New Trade
            </button>
          )}

          {showForm && (
            <TradeForm
              initial={editing ? trades.find(t => t.id === editing) : emptyTrade()}
              editing={!!editing}
              onSubmit={handleAddTrade}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          )}

          <TradeTable trades={trades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} />
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && <Dashboard trades={trades} />}

      {/* Weekly Tab */}
      {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} />}
    </Layout>
  )
}
```

**Step 2: Verify the app runs end-to-end**

Run in separate terminals:
```bash
# Terminal 1: server
cd server && node index.js

# Terminal 2: client
cd client && npx vite
```

Expected: App loads at localhost:3000, can create/edit/delete trades, view dashboard, manage notes.

**Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire up App with all components and API integration"
```

---

### Task 14: Dockerfile & Production Build

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build

FROM node:20-alpine

WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev
COPY server ./server

# Copy built frontend into server/public
COPY --from=builder /app/server/public ./server/public

EXPOSE 3001

CMD ["node", "server/index.js"]
```

**Step 2: Create .dockerignore**

```
node_modules
data
*.db
.git
docs
```

**Step 3: Create docker-compose.yml**

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

**Step 4: Test Docker build**

Run:
```bash
docker build -t trading-journal .
docker run -p 3001:3001 -v $(pwd)/data:/app/data trading-journal
```

Expected: App accessible at localhost:3001, data persisted in `./data/journal.db`.

**Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker setup for production deployment"
```

---

### Task 15: Final Verification

**Step 1: Full clean test**

```bash
rm -rf node_modules client/node_modules server/node_modules server/public data
npm run install:all
npm run build
npm start
```

Expected: Server starts on port 3001, serves the built frontend, all CRUD operations work, export downloads JSON file.

**Step 2: Docker test**

```bash
docker compose up --build
```

Expected: Container runs, app accessible at localhost:3001.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
