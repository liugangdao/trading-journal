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
