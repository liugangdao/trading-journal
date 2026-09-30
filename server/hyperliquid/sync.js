import db from '../db.js'
import { randomUUID } from 'node:crypto'
import { getFillsByTime, getPerpState } from './client.js'
import { parsePerpFill, reconcileFill } from './reconcile.js'

const running = new Map()
const round = value => Math.round(value * 1e8) / 1e8
const tradeTime = millis => new Date(millis).toLocaleString('sv-SE', {
  timeZone: 'Asia/Shanghai', hour12: false,
}).replace(' ', 'T').slice(0, 16)
const pairName = coin => `${coin}USD`
const direction = size => size > 0 ? '多(Buy)' : '空(Sell)'

function openTrade(userId, address, coin, size, price, time, ref, fee = 0, entryUnknown = false) {
  const result = db.prepare(`
    INSERT INTO trades (user_id, open_time, pair, direction, strategy, timeframe, lots, entry, stop,
      status, source, source_account, source_coin, source_ref, source_position_size,
      source_fee_usd, source_entry_unknown, source_sync_note)
    VALUES (?, ?, ?, ?, 'Hyperliquid 自动同步', '—', ?, ?, 0,
      'open', 'hyperliquid', ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, tradeTime(time), pairName(coin), direction(size), Math.abs(size), price,
    address, coin, ref, size, fee, Number(entryUnknown), entryUnknown ? '接入前已有持仓，开仓时间及历史费用可能不完整' : null)
  return result.lastInsertRowid
}

function updateOpenTrade(trade, fill, action, fee) {
  const increasing = action.kind === 'increase'
  const nextEntry = increasing
    ? (Number(trade.entry) * Math.abs(trade.source_position_size) + fill.price * action.openSize) / Math.abs(action.after)
    : Number(trade.entry)
  const realized = round(Number(trade.source_realized_pnl || 0) + (action.closeSize ? fill.pnl : 0))
  const fees = round(Number(trade.source_fee_usd || 0) + fee)
  const hasExit = action.closeSize > 0 || trade.gross_pnl != null
  db.prepare(`
    UPDATE trades SET source_position_size = ?, lots = ?, entry = ?, exit_price = ?,
      source_realized_pnl = ?, source_fee_usd = ?, gross_pnl = ?,
      status = ?, close_time = ?, updated_at = datetime('now') WHERE id = ?
  `).run(action.after, Math.abs(action.after) || Number(trade.lots), round(nextEntry),
    action.closeSize ? fill.price : trade.exit_price,
    realized, fees, hasExit ? round(realized - fees) : null,
    action.after === 0 ? 'closed' : 'open', action.after === 0 ? tradeTime(fill.time) : null, trade.id)
}

function applyFill(userId, address, fill) {
  const inserted = db.prepare(`
    INSERT OR IGNORE INTO hyperliquid_fills (user_id, address, tid, coin, time_ms)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, address, fill.tid, fill.coin, fill.time)
  if (!inserted.changes) return false

  const trade = db.prepare(`
    SELECT * FROM trades WHERE user_id = ? AND source = 'hyperliquid'
      AND source_account = ? AND source_coin = ? AND status = 'open' AND source_detached = 0
    ORDER BY id DESC LIMIT 1
  `).get(userId, address, fill.coin)
  const action = reconcileFill(Number(trade?.source_position_size || 0), fill)
  let tradeId = trade?.id || null

  if (action.kind === 'open') {
    tradeId = openTrade(userId, address, fill.coin, action.after, fill.price, fill.time,
      `${address}/${fill.coin}/${fill.tid}`, fill.fee)
  } else if (action.kind === 'reverse') {
    if (!trade) throw new Error(`${fill.coin} 缺少反手前的交易`)
    const closingFee = fill.fee * action.closeSize / fill.size
    updateOpenTrade(trade, fill, { ...action, after: 0 }, closingFee)
    tradeId = openTrade(userId, address, fill.coin, action.after, fill.price, fill.time,
      `${address}/${fill.coin}/${fill.tid}`, fill.fee - closingFee)
  } else {
    if (!trade) throw new Error(`${fill.coin} 缺少进行中的交易`)
    updateOpenTrade(trade, fill, action, fill.fee)
  }
  db.prepare('UPDATE hyperliquid_fills SET trade_id = ? WHERE user_id = ? AND address = ? AND tid = ?')
    .run(tradeId, userId, address, fill.tid)
  return true
}

async function fetchAllFills(address, cursor, startedAt, endTime) {
  const start = cursor === startedAt ? cursor + 1 : cursor
  if (start > endTime) return []
  const unique = new Map()
  let requests = 0
  async function collect(from, to) {
    if (++requests > 24) throw new Error('成交查询范围过大，需人工核对')
    const batch = await getFillsByTime(address, from, to)
    if (batch.length >= 2000) {
      if (from >= to) throw new Error('同一毫秒成交超过接口上限，需人工核对')
      const middle = Math.floor((from + to) / 2)
      await collect(from, middle)
      await collect(middle + 1, to)
      return
    }
    for (const raw of batch) {
      const fill = parsePerpFill(raw)
      if (fill && fill.time >= from && fill.time <= to) unique.set(fill.tid, fill)
    }
    if (unique.size >= 10000) throw new Error('成交数量达到交易所可查询上限，需人工核对')
  }
  await collect(start, endTime)
  return [...unique.values()].sort((a, b) => a.time - b.time || a.tid.localeCompare(b.tid))
}

function comparePositions(userId, address, state) {
  const actual = new Map(state.assetPositions.map(item => [item.position.coin, Number(item.position.szi)]))
  const open = db.prepare(`SELECT source_coin, source_position_size FROM trades
    WHERE user_id = ? AND source = 'hyperliquid' AND source_account = ?
      AND status = 'open' AND source_detached = 0`).all(userId, address)
  for (const trade of open) {
    if (Math.abs(Number(trade.source_position_size) - (actual.get(trade.source_coin) || 0)) > 1e-8) {
      throw new Error(`${trade.source_coin} 持仓与交易所不一致，需人工核对`)
    }
    actual.delete(trade.source_coin)
  }
  for (const [coin, size] of actual) {
    if (Math.abs(size) > 1e-8) throw new Error(`${coin} 出现未记录持仓，需人工核对`)
  }
}

function applyOrderedFills(userId, address, fills) {
  let changed = 0
  for (let offset = 0; offset < fills.length;) {
    const time = fills[offset].time
    const pending = []
    while (offset < fills.length && fills[offset].time === time) pending.push(fills[offset++])
    while (pending.length) {
      const index = pending.findIndex(fill => {
        if (db.prepare('SELECT 1 FROM hyperliquid_fills WHERE user_id = ? AND address = ? AND tid = ?')
          .get(userId, address, fill.tid)) return true
        const open = db.prepare(`SELECT source_position_size FROM trades WHERE user_id = ?
          AND source = 'hyperliquid' AND source_account = ? AND source_coin = ?
          AND status = 'open' AND source_detached = 0
          ORDER BY id DESC LIMIT 1`).get(userId, address, fill.coin)
        return Math.abs(Number(open?.source_position_size || 0) - fill.start) < 1e-10
      })
      if (index < 0) throw new Error('同一时间的成交无法按持仓顺序归并，需人工核对')
      if (applyFill(userId, address, pending.splice(index, 1)[0])) changed++
    }
  }
  return changed
}

export async function bindHyperliquid(userId, address) {
  const state = await getPerpState(address)
  const existing = db.prepare('SELECT address FROM hyperliquid_accounts WHERE user_id = ?').get(userId)
  if (existing?.address === address) return { alreadyBound: true }
  db.transaction(() => {
    if (existing) {
      db.prepare(`UPDATE trades SET source_sync_note = '账户已更换，停止自动更新', source_detached = 1
        WHERE user_id = ? AND source = 'hyperliquid' AND source_account = ? AND status = 'open'`)
        .run(userId, existing.address)
    }
    db.prepare(`INSERT INTO hyperliquid_accounts (user_id, address, started_at_ms, cursor_ms, last_synced_at, last_error)
      VALUES (?, ?, ?, ?, datetime('now'), NULL)
      ON CONFLICT(user_id) DO UPDATE SET address=excluded.address, started_at_ms=excluded.started_at_ms,
        cursor_ms=excluded.cursor_ms, last_synced_at=excluded.last_synced_at, last_error=NULL`)
      .run(userId, address, state.time, state.time)
    for (const item of state.assetPositions) {
      const { coin, szi, entryPx } = item.position
      const size = Number(szi)
      if (size === 0) continue
      openTrade(userId, address, coin, size, Number(entryPx), state.time,
        `${address}/${coin}/snapshot/${state.time}/${randomUUID()}`, 0, true)
    }
  })()
  return { alreadyBound: false }
}

async function syncOnce(userId) {
  const account = db.prepare('SELECT * FROM hyperliquid_accounts WHERE user_id = ?').get(userId)
  if (!account) throw new Error('尚未绑定 Hyperliquid 账户')
  try {
    const state = await getPerpState(account.address)
    if (state.time < account.cursor_ms) throw new Error('交易所快照时间早于上次同步，请稍后重试')
    const fills = await fetchAllFills(account.address, account.cursor_ms, account.started_at_ms, state.time)
    let changed = 0
    db.transaction(() => {
      const current = db.prepare('SELECT address, cursor_ms FROM hyperliquid_accounts WHERE user_id = ?').get(userId)
      if (current?.address !== account.address || current.cursor_ms !== account.cursor_ms) throw new Error('账户配置已变化，请重试同步')
      changed = applyOrderedFills(userId, account.address, fills)
      comparePositions(userId, account.address, state)
      db.prepare(`UPDATE hyperliquid_accounts SET cursor_ms = ?, last_synced_at = datetime('now'), last_error = NULL
        WHERE user_id = ? AND address = ?`).run(state.time, userId, account.address)
    })()
    return { changed, syncedAt: new Date().toISOString() }
  } catch (error) {
    db.prepare('UPDATE hyperliquid_accounts SET last_error = ? WHERE user_id = ? AND address = ?')
      .run(error.message, userId, account.address)
    throw error
  }
}

export function syncHyperliquid(userId) {
  if (running.has(userId)) return running.get(userId)
  const promise = syncOnce(userId).finally(() => running.delete(userId))
  running.set(userId, promise)
  return promise
}
