import { Router, raw } from 'express'
import db from '../db.js'

const router = Router()
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const textFields = ['market_environment', 'setup', 'entry_reason', 'invalidation', 'execution_note']
const exitReasons = new Set(['结构止损', '移动止损', 'measured move目标', '手动平仓'])
const executionTags = new Set(['计划内', 'FOMO', '追涨杀跌', '提前平仓', '移动止损过早', '逆势', '未等收盘确认'])

function validTrade(body) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.open_time || '')) return '请填写交易时间'
  if (!body.pair || typeof body.pair !== 'string' || body.pair.length > 60) return '请选择品种'
  if (!['多(Buy)', '空(Sell)'].includes(body.direction)) return '请选择方向'
  for (const field of textFields) {
    if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > 2000)) return '文字内容不能超过 2000 字'
  }
  if (!String(body.entry_reason || '').trim()) return '请写一句入场理由'
  if (!String(body.invalidation || '').trim()) return '请写一句失效条件'
  const hasR = body.result_r !== null && body.result_r !== undefined && body.result_r !== ''
  const hasDollars = body.gross_pnl !== null && body.gross_pnl !== undefined && body.gross_pnl !== ''
  if (hasR &&
      (!Number.isFinite(Number(body.result_r)) || Math.abs(Number(body.result_r)) > 1000)) return '最终结果须为有效的 R 值'
  if (hasDollars && (!Number.isFinite(Number(body.gross_pnl)) || Math.abs(Number(body.gross_pnl)) > 1_000_000_000)) return '美元盈亏须为有效数字'
  if (body.exit_reason && !exitReasons.has(body.exit_reason)) return '请选择有效的退出原因'
  if (!Array.isArray(body.execution_tags) || body.execution_tags.some(tag => !executionTags.has(tag)) || new Set(body.execution_tags).size !== body.execution_tags.length) return '执行评价标签无效'
  if (body.good_trade != null && typeof body.good_trade !== 'boolean') return '请选择是否为好交易'
  if ((hasR || hasDollars) && (!body.exit_reason || !body.execution_tags.length || body.good_trade == null)) return '结束交易时请填写退出原因、执行评价，并回答是否为好交易'
  if ((hasR || hasDollars) && (body.exit_reason === '手动平仓' || body.execution_tags.includes('提前平仓')) && !String(body.execution_note || '').trim()) return '请写明提前或手动平仓的原因'
  return null
}

function tradeParams(body) {
  return [
    body.open_time, body.pair.trim(), body.direction,
    ...textFields.map(field => body[field]?.trim() || ''),
    body.exit_reason || null, JSON.stringify(body.execution_tags),
    body.result_r === '' || body.result_r == null ? null : Number(body.result_r),
    body.gross_pnl === '' || body.gross_pnl == null ? null : Number(body.gross_pnl),
    body.good_trade == null ? null : Number(body.good_trade),
  ]
}

function ownTrade(id, userId) {
  return db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?').get(id, userId)
}

// 月视图只传交易文字与图片数量，图片通过单独接口读取。
router.get('/', (req, res) => {
  const month = req.query.month
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return res.status(400).json({ error: '月份格式不正确' })
  try {
    const trades = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM trade_images i WHERE i.trade_id = t.id) AS image_count
      FROM trades t WHERE t.user_id = ? AND t.open_time >= ? AND t.open_time < ?
      ORDER BY t.open_time DESC, t.id DESC
    `).all(req.session.userId, `${month}-01`, `${month}-32`)
    res.json(trades)
  } catch (error) { res.status(500).json({ error: error.message }) }
})

router.get('/goals/:week', (req, res) => {
  if (!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(req.params.week)) return res.status(400).json({ error: '周格式不正确' })
  const goal = db.prepare('SELECT content FROM weekly_goals WHERE user_id = ? AND week_key = ?').get(req.session.userId, req.params.week)
  res.json({ week: req.params.week, content: goal?.content || '' })
})

router.put('/goals/:week', (req, res) => {
  if (!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(req.params.week)) return res.status(400).json({ error: '周格式不正确' })
  const content = req.body?.content
  if (typeof content !== 'string' || content.length > 500) return res.status(400).json({ error: '周目标不能超过 500 字' })
  db.prepare(`INSERT INTO weekly_goals (user_id, week_key, content) VALUES (?, ?, ?)
    ON CONFLICT(user_id, week_key) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`)
    .run(req.session.userId, req.params.week, content.trim())
  res.json({ week: req.params.week, content: content.trim() })
})

router.post('/', (req, res) => {
  const error = validTrade(req.body || {})
  if (error) return res.status(400).json({ error })
  try {
    const hasResult = [req.body.result_r, req.body.gross_pnl].some(value => value !== '' && value != null)
    const result = db.prepare(`
      INSERT INTO trades (user_id, open_time, pair, direction, market_environment, setup,
        entry_reason, invalidation, execution_note, exit_reason, execution_tags, result_r, gross_pnl, good_trade,
        strategy, timeframe, entry, stop, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '未分类', '—', 0, 0, ?)
    `).run(req.session.userId, ...tradeParams(req.body), hasResult ? 'closed' : 'open')
    res.status(201).json(ownTrade(result.lastInsertRowid, req.session.userId))
  } catch (error) { res.status(500).json({ error: error.message }) }
})

router.put('/:id', (req, res) => {
  const current = ownTrade(req.params.id, req.session.userId)
  if (!current) return res.status(404).json({ error: '交易不存在' })
  if (current.source === 'hyperliquid') {
    const body = req.body || {}
    for (const field of [...textFields, 'risk_plan']) {
      if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > 2000)) {
        return res.status(400).json({ error: '文字内容不能超过 2000 字' })
      }
    }
    if (body.exit_reason && !exitReasons.has(body.exit_reason)) return res.status(400).json({ error: '退出原因无效' })
    if (!Array.isArray(body.execution_tags) || body.execution_tags.some(tag => !executionTags.has(tag)) ||
        new Set(body.execution_tags).size !== body.execution_tags.length) return res.status(400).json({ error: '执行评价标签无效' })
    if (body.good_trade != null && typeof body.good_trade !== 'boolean') return res.status(400).json({ error: '好交易评价无效' })
    const resultR = body.result_r === '' || body.result_r == null ? null : Number(body.result_r)
    if (resultR != null && (!Number.isFinite(resultR) || Math.abs(resultR) > 1000)) return res.status(400).json({ error: 'R 值无效' })
    if ((body.exit_reason === '手动平仓' || body.execution_tags.includes('提前平仓')) &&
        !String(body.execution_note || '').trim()) return res.status(400).json({ error: '请写明提前或手动平仓的原因' })
    db.prepare(`UPDATE trades SET market_environment = ?, setup = ?, entry_reason = ?, invalidation = ?,
      execution_note = ?, exit_reason = ?, execution_tags = ?, good_trade = ?, result_r = ?,
      updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(
      body.market_environment?.trim() || '', body.setup?.trim() || '', body.entry_reason?.trim() || '',
      body.invalidation?.trim() || '', body.execution_note?.trim() || '', body.exit_reason || null,
      JSON.stringify(body.execution_tags), body.good_trade == null ? null : Number(body.good_trade),
      resultR, req.params.id, req.session.userId,
    )
    return res.json(ownTrade(req.params.id, req.session.userId))
  }
  const error = validTrade(req.body || {})
  if (error) return res.status(400).json({ error })
  try {
    const hasResult = [req.body.result_r, req.body.gross_pnl].some(value => value !== '' && value != null)
    const status = hasResult ? 'closed' : 'open'
    db.prepare(`
      UPDATE trades SET open_time = ?, pair = ?, direction = ?, market_environment = ?, setup = ?,
        entry_reason = ?, invalidation = ?, execution_note = ?, exit_reason = ?, execution_tags = ?, result_r = ?,
        gross_pnl = ?, good_trade = ?, status = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(...tradeParams(req.body), status, req.params.id, req.session.userId)
    res.json(ownTrade(req.params.id, req.session.userId))
  } catch (error) { res.status(500).json({ error: error.message }) }
})

router.delete('/:id', (req, res) => {
  const current = ownTrade(req.params.id, req.session.userId)
  if (!current) return res.status(404).json({ error: '交易不存在' })
  if (current.source === 'hyperliquid' && current.status === 'open' && !current.source_detached &&
      db.prepare('SELECT 1 FROM hyperliquid_accounts WHERE user_id = ? AND address = ?')
        .get(req.session.userId, current.source_account)) return res.status(409).json({ error: '同步中的持仓不能删除，请先解绑账户' })
  db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId)
  res.json({ success: true })
})

router.get('/:id/images', (req, res) => {
  if (!ownTrade(req.params.id, req.session.userId)) return res.status(404).json({ error: '交易不存在' })
  const images = db.prepare('SELECT id, created_at FROM trade_images WHERE trade_id = ? ORDER BY id').all(req.params.id)
  res.json(images)
})

router.post('/:id/images', raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }), (req, res) => {
  if (!ownTrade(req.params.id, req.session.userId)) return res.status(404).json({ error: '交易不存在' })
  const mime = req.headers['content-type']?.split(';')[0]
  if (!imageTypes.has(mime) || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: '请选择 PNG、JPEG 或 WebP 图片' })
  if (db.prepare('SELECT COUNT(*) AS count FROM trade_images WHERE trade_id = ?').get(req.params.id).count >= 8) return res.status(400).json({ error: '每笔交易最多保存 8 张图片' })
  const result = db.prepare('INSERT INTO trade_images (trade_id, mime_type, image_data) VALUES (?, ?, ?)').run(req.params.id, mime, req.body)
  res.status(201).json({ id: result.lastInsertRowid })
})

router.get('/:id/images/:imageId', (req, res) => {
  if (!ownTrade(req.params.id, req.session.userId)) return res.status(404).json({ error: '交易不存在' })
  const image = db.prepare('SELECT mime_type, image_data FROM trade_images WHERE id = ? AND trade_id = ?').get(req.params.imageId, req.params.id)
  if (!image) return res.status(404).json({ error: '图片不存在' })
  res.set('Cache-Control', 'private, no-store')
  res.type(image.mime_type).send(image.image_data)
})

router.delete('/:id/images/:imageId', (req, res) => {
  if (!ownTrade(req.params.id, req.session.userId)) return res.status(404).json({ error: '交易不存在' })
  const result = db.prepare('DELETE FROM trade_images WHERE id = ? AND trade_id = ?').run(req.params.imageId, req.params.id)
  if (!result.changes) return res.status(404).json({ error: '图片不存在' })
  res.json({ success: true })
})

export default router
