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

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

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
    if (from) { tradeQuery += ' AND date >= ?'; params.push(from) }
    if (to) { tradeQuery += ' AND date <= ?'; params.push(to) }
    tradeQuery += ' ORDER BY date DESC'
    const trades = db.prepare(tradeQuery).all(...params)
    const weeklyNotes = db.prepare('SELECT * FROM weekly_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    const monthlyNotes = db.prepare('SELECT * FROM monthly_notes WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    const data = {
      exportDate: new Date().toISOString(),
      dateRange: { from: from || null, to: to || null },
      trades,
      weeklyNotes,
      monthlyNotes
    }
    res.setHeader('Content-Disposition', `attachment; filename="trading-journal-${new Date().toISOString().split('T')[0]}.json"`)
    res.json(data)
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
