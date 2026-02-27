import express from 'express'
import cors from 'cors'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import tradesRouter from './routes/trades.js'
import notesRouter from './routes/notes.js'
import monthlyNotesRouter from './routes/monthly-notes.js'
import pairsRouter from './routes/pairs.js'
import policiesRouter from './routes/policies.js'
import violationsRouter from './routes/violations.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/trades', tradesRouter)
app.use('/api/notes', notesRouter)
app.use('/api/monthly-notes', monthlyNotesRouter)
app.use('/api/pairs', pairsRouter)
app.use('/api/policies', policiesRouter)
app.use('/api', violationsRouter)

// Export data as JSON with optional date range
app.get('/api/export', (req, res) => {
  try {
    const { from, to } = req.query
    let tradeQuery = 'SELECT * FROM trades'
    const params = []
    if (from && to) {
      tradeQuery += ' WHERE date >= ? AND date <= ?'
      params.push(from, to)
    } else if (from) {
      tradeQuery += ' WHERE date >= ?'
      params.push(from)
    } else if (to) {
      tradeQuery += ' WHERE date <= ?'
      params.push(to)
    }
    tradeQuery += ' ORDER BY date DESC'
    const trades = db.prepare(tradeQuery).all(...params)
    const weeklyNotes = db.prepare('SELECT * FROM weekly_notes ORDER BY created_at DESC').all()
    const monthlyNotes = db.prepare('SELECT * FROM monthly_notes ORDER BY created_at DESC').all()
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
