import { Router } from 'express'
import db from '../db.js'

const router = Router()

// GET /api/monthly-notes - list all monthly notes
router.get('/', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM monthly_notes ORDER BY created_at DESC').all()
    res.json(notes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/monthly-notes - create monthly note
router.post('/', (req, res) => {
  try {
    const { month, lesson, plan } = req.body
    if (!month) return res.status(400).json({ error: 'Month is required' })
    const stmt = db.prepare('INSERT INTO monthly_notes (month, lesson, plan) VALUES (?, ?, ?)')
    const result = stmt.run(month, lesson || null, plan || null)
    const note = db.prepare('SELECT * FROM monthly_notes WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(note)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/monthly-notes/:id - delete monthly note
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM monthly_notes WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Note not found' })
    db.prepare('DELETE FROM monthly_notes WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
