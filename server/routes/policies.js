import { Router } from 'express'
import db from '../db.js'

const router = Router()

// GET /api/policies — optional ?category= filter
router.get('/', (req, res) => {
  try {
    const userId = req.session.userId
    const { category } = req.query
    let query = 'SELECT * FROM policies WHERE user_id = ?'
    const params = [userId]
    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }
    query += ' ORDER BY category, sort_order, id'
    const policies = db.prepare(query).all(...params)
    res.json(policies)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/policies
router.post('/', (req, res) => {
  try {
    const userId = req.session.userId
    const { category, title, content, sort_order } = req.body
    if (!category || !title || !content) {
      return res.status(400).json({ error: '分类、标题和内容为必填项' })
    }
    const result = db.prepare(
      'INSERT INTO policies (user_id, category, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, category, title.trim(), content.trim(), sort_order ?? 0)
    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(policy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/policies/:id
router.put('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const existing = db.prepare('SELECT * FROM policies WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    if (!existing) return res.status(404).json({ error: 'Policy not found' })
    const { category, title, content, sort_order } = req.body
    db.prepare(
      "UPDATE policies SET category = ?, title = ?, content = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(
      category ?? existing.category,
      title?.trim() ?? existing.title,
      content?.trim() ?? existing.content,
      sort_order ?? existing.sort_order,
      req.params.id, userId
    )
    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id)
    res.json(policy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/policies/:id
router.delete('/:id', (req, res) => {
  try {
    const userId = req.session.userId
    const existing = db.prepare('SELECT * FROM policies WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    if (!existing) return res.status(404).json({ error: 'Policy not found' })
    db.prepare('DELETE FROM policies WHERE id = ? AND user_id = ?').run(req.params.id, userId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/policies/:id/toggle — toggle is_active
router.put('/:id/toggle', (req, res) => {
  try {
    const userId = req.session.userId
    const existing = db.prepare('SELECT * FROM policies WHERE id = ? AND user_id = ?').get(req.params.id, userId)
    if (!existing) return res.status(404).json({ error: 'Policy not found' })
    const newActive = existing.is_active ? 0 : 1
    db.prepare("UPDATE policies SET is_active = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(newActive, req.params.id, userId)
    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id)
    res.json(policy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
