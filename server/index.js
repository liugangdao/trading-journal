import express from 'express'
import cors from 'cors'
import session from 'express-session'
import SqliteStore from 'better-sqlite3-session-store'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import requireAuth from './middleware/requireAuth.js'
import authRouter from './routes/auth.js'
import tradesRouter from './routes/trades.js'
import notesRouter from './routes/notes.js'
import monthlyNotesRouter from './routes/monthly-notes.js'
import pairsRouter from './routes/pairs.js'
import policiesRouter from './routes/policies.js'
import violationsRouter from './routes/violations.js'
import journalRouter from './routes/journal.js'
import hyperliquidRouter from './routes/hyperliquid.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

// Session middleware
const BetterSqlite3Store = SqliteStore(session)
app.use(session({
  store: new BetterSqlite3Store({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || 'trading-journal-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  },
}))

// Auth routes (public)
app.use('/api/auth', authRouter)

// Protected API routes
app.use('/api/trades', requireAuth, tradesRouter)
app.use('/api/journal', requireAuth, journalRouter)
app.use('/api/hyperliquid', requireAuth, hyperliquidRouter)
app.use('/api/notes', requireAuth, notesRouter)
app.use('/api/monthly-notes', requireAuth, monthlyNotesRouter)
app.use('/api/pairs', requireAuth, pairsRouter)
app.use('/api/policies', requireAuth, policiesRouter)
app.use('/api', requireAuth, violationsRouter)

// Export data as JSON with optional date range
app.get('/api/export', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId
    const { from, to } = req.query
    let tradeQuery = 'SELECT * FROM trades WHERE user_id = ?'
    const params = [userId]
    if (from) { tradeQuery += ' AND open_time >= ?'; params.push(from + 'T00:00') }
    if (to) { tradeQuery += ' AND open_time <= ?'; params.push(to + 'T23:59') }
    tradeQuery += ' ORDER BY open_time DESC'
    const trades = db.prepare(tradeQuery).all(...params)
    const weeklyNotes = db.prepare('SELECT * FROM weekly_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    const monthlyNotes = db.prepare('SELECT * FROM monthly_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    const weeklyGoals = db.prepare('SELECT week_key, content FROM weekly_goals WHERE user_id = ?').all(userId)
    const imageStatement = db.prepare('SELECT mime_type, image_data FROM trade_images WHERE trade_id = ? ORDER BY id')
    const tradeImages = trades.flatMap(trade => imageStatement.all(trade.id).map(image => ({
      trade_id: trade.id, mime_type: image.mime_type, data: image.image_data.toString('base64'),
    })))
    const data = {
      exportDate: new Date().toISOString(),
      dateRange: { from: from || null, to: to || null },
      trades,
      weeklyNotes,
      monthlyNotes,
      weeklyGoals,
      tradeImages
    }
    res.setHeader('Content-Disposition', `attachment; filename="trading-journal-${new Date().toISOString().split('T')[0]}.json"`)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Import data from exported JSON
app.post('/api/import', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId
    const { trades, weeklyNotes, monthlyNotes, weeklyGoals, tradeImages } = req.body
    if (!trades && !weeklyNotes && !monthlyNotes && !weeklyGoals) {
      return res.status(400).json({ error: '无效的导入数据' })
    }

    const result = { trades: 0, weeklyNotes: 0, monthlyNotes: 0, weeklyGoals: 0, tradeImages: 0 }

    const importAll = db.transaction(() => {
      const importedIds = new Map()
      if (trades && trades.length) {
        const stmt = db.prepare(`
          INSERT INTO trades (user_id, open_time, close_time, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status, risk_amount, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const updateJournal = db.prepare(`UPDATE trades SET market_environment=?, setup=?, entry_reason=?, invalidation=?, risk_plan=?, result_r=?, execution_note=?, exit_reason=?, execution_tags=?, good_trade=? WHERE id=? AND user_id=?`)
        for (const t of trades) {
          const openTime = t.open_time || (t.date ? t.date + 'T00:00' : new Date().toISOString().slice(0, 16))
          const closeTime = t.close_time || null
          const inserted = stmt.run(userId, openTime, closeTime, t.pair, t.direction, t.strategy || '未分类', t.timeframe || '—', t.lots ?? null, t.entry ?? 0, t.stop ?? 0, t.target ?? null, t.exit_price ?? null, t.gross_pnl ?? null, t.swap ?? 0, t.score ?? null, t.emotion ?? null, t.notes ?? null, t.status || 'closed', t.risk_amount ?? null, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString())
          updateJournal.run(t.market_environment || null, t.setup || null, t.entry_reason || null, t.invalidation || null, t.risk_plan || null, t.result_r ?? null, t.execution_note || null, t.exit_reason || null, t.execution_tags || null, t.good_trade ?? null, inserted.lastInsertRowid, userId)
          if (t.id != null) importedIds.set(t.id, inserted.lastInsertRowid)
          result.trades++
        }
      }
      if (weeklyNotes && weeklyNotes.length) {
        const stmt = db.prepare('INSERT INTO weekly_notes (user_id, week, lesson, plan, created_at) VALUES (?, ?, ?, ?, ?)')
        for (const n of weeklyNotes) {
          stmt.run(userId, n.week, n.lesson ?? null, n.plan ?? null, n.created_at || new Date().toISOString())
          result.weeklyNotes++
        }
      }
      if (monthlyNotes && monthlyNotes.length) {
        const stmt = db.prepare('INSERT INTO monthly_notes (user_id, month, lesson, plan, created_at) VALUES (?, ?, ?, ?, ?)')
        for (const n of monthlyNotes) {
          stmt.run(userId, n.month, n.lesson ?? null, n.plan ?? null, n.created_at || new Date().toISOString())
          result.monthlyNotes++
        }
      }
      if (weeklyGoals && weeklyGoals.length) {
        const stmt = db.prepare(`INSERT INTO weekly_goals (user_id, week_key, content) VALUES (?, ?, ?)
          ON CONFLICT(user_id, week_key) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`)
        for (const goal of weeklyGoals) {
          if (typeof goal.week_key !== 'string' || typeof goal.content !== 'string') continue
          stmt.run(userId, goal.week_key, goal.content)
          result.weeklyGoals++
        }
      }
      if (tradeImages && tradeImages.length) {
        const stmt = db.prepare('INSERT INTO trade_images (trade_id, mime_type, image_data) VALUES (?, ?, ?)')
        for (const image of tradeImages) {
          const tradeId = importedIds.get(image.trade_id)
          if (!tradeId || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mime_type) || typeof image.data !== 'string' || image.data.length > 7_000_000) continue
          stmt.run(tradeId, image.mime_type, Buffer.from(image.data, 'base64'))
          result.tradeImages++
        }
      }
    })
    importAll()

    res.json({ success: true, imported: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve frontend in production
const publicDir = join(__dirname, 'public')
if (existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.get('{*path}', (req, res) => {
    res.sendFile(join(publicDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
