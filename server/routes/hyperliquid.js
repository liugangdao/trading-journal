import { Router } from 'express'
import db from '../db.js'
import { normalizeAddress } from '../hyperliquid/client.js'
import { bindHyperliquid, syncHyperliquid } from '../hyperliquid/sync.js'

const router = Router()

function currentAccount(userId) {
  const account = db.prepare(`SELECT address, started_at_ms, last_synced_at, last_error
    FROM hyperliquid_accounts WHERE user_id = ?`).get(userId)
  return account || null
}

router.get('/', (req, res) => res.json(currentAccount(req.session.userId)))

router.put('/', async (req, res) => {
  let address
  try { address = normalizeAddress(req.body?.address) }
  catch (error) { return res.status(400).json({ error: error.message }) }
  try {
    await bindHyperliquid(req.session.userId, address)
    res.json(currentAccount(req.session.userId))
  } catch (error) { res.status(502).json({ error: error.message }) }
})

router.delete('/', (req, res) => {
  db.transaction(() => {
    const account = db.prepare('SELECT address FROM hyperliquid_accounts WHERE user_id = ?').get(req.session.userId)
    if (!account) return
    db.prepare(`UPDATE trades SET source_sync_note = '账户已解绑，停止自动更新', source_detached = 1
      WHERE user_id = ? AND source = 'hyperliquid' AND source_account = ? AND status = 'open'`)
      .run(req.session.userId, account.address)
    db.prepare('DELETE FROM hyperliquid_accounts WHERE user_id = ?').run(req.session.userId)
  })()
  res.json({ success: true })
})

router.post('/sync', async (req, res) => {
  try { res.json(await syncHyperliquid(req.session.userId)) }
  catch (error) { res.status(502).json({ error: error.message }) }
})

export default router
