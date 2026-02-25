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

// POST /api/trades - create trade (open or closed)
router.post('/', (req, res) => {
  try {
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status } = req.body
    const tradeStatus = status || 'open'
    const tradeDate = date || new Date().toISOString().split('T')[0]
    const tradeStrategy = strategy || '趋势跟踪'
    const tradeTimeframe = timeframe || 'H4'

    if (!pair || !direction || entry == null || stop == null) {
      return res.status(400).json({ error: 'Missing required fields: pair, direction, entry, stop' })
    }
    if (tradeStatus === 'closed' && (exit_price == null || gross_pnl == null)) {
      return res.status(400).json({ error: 'Closed trades require exit_price and gross_pnl' })
    }
    const stmt = db.prepare(`
      INSERT INTO trades (date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(tradeDate, pair, direction, tradeStrategy, tradeTimeframe, lots || null, entry, stop, target || null, exit_price ?? null, gross_pnl ?? null, swap || 0, score || null, emotion || null, notes || null, tradeStatus)
    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/trades/:id - update trade (close or edit)
router.put('/:id', (req, res) => {
  try {
    const { date, pair, direction, strategy, timeframe, lots, entry, stop, target, exit_price, gross_pnl, swap, score, emotion, notes, status } = req.body
    const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Trade not found' })

    const tradeStatus = status || existing.status
    if (tradeStatus === 'closed' && (exit_price == null || gross_pnl == null)) {
      return res.status(400).json({ error: 'Closed trades require exit_price and gross_pnl' })
    }

    const stmt = db.prepare(`
      UPDATE trades SET date=?, pair=?, direction=?, strategy=?, timeframe=?, lots=?, entry=?, stop=?, target=?, exit_price=?, gross_pnl=?, swap=?, score=?, emotion=?, notes=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `)
    stmt.run(
      date ?? existing.date, pair ?? existing.pair, direction ?? existing.direction,
      strategy ?? existing.strategy, timeframe ?? existing.timeframe, lots || existing.lots,
      entry ?? existing.entry, stop ?? existing.stop, target || existing.target,
      exit_price ?? null, gross_pnl ?? null, swap || 0,
      score || null, emotion || null, notes || null,
      tradeStatus, req.params.id
    )
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
