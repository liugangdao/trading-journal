import express from 'express'
import cors from 'cors'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import tradesRouter from './routes/trades.js'
import notesRouter from './routes/notes.js'
import monthlyNotesRouter from './routes/monthly-notes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/trades', tradesRouter)
app.use('/api/notes', notesRouter)
app.use('/api/monthly-notes', monthlyNotesRouter)

// Export all data as JSON
app.get('/api/export', (req, res) => {
  try {
    const trades = db.prepare('SELECT * FROM trades ORDER BY date DESC').all()
    const weeklyNotes = db.prepare('SELECT * FROM weekly_notes ORDER BY created_at DESC').all()
    const monthlyNotes = db.prepare('SELECT * FROM monthly_notes ORDER BY created_at DESC').all()
    const data = {
      exportDate: new Date().toISOString(),
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
