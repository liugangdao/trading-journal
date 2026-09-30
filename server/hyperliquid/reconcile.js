const EPSILON = 1e-10

const zero = value => Math.abs(value) < EPSILON ? 0 : value

export function parsePerpFill(fill) {
  if (!fill || typeof fill.coin !== 'string' || !fill.coin || fill.coin.startsWith('@') || fill.coin.includes(':') || fill.coin.includes('/')) return null
  const start = Number(fill.startPosition)
  const size = Number(fill.sz)
  const price = Number(fill.px)
  const pnl = Number(fill.closedPnl)
  const fee = Number(fill.fee)
  const time = Number(fill.time)
  const tid = String(fill.tid ?? '')
  if (!Number.isFinite(start) || !Number.isFinite(size) || size <= 0 ||
      !Number.isFinite(price) || price <= 0 || !Number.isFinite(pnl) ||
      !Number.isFinite(fee) || !Number.isSafeInteger(time) || !tid ||
      !['A', 'B'].includes(fill.side) || String(fill.feeToken || '').trim() !== 'USDC') {
    throw new Error('Hyperliquid 成交字段不完整，已暂停同步')
  }
  return { coin: fill.coin, start: zero(start), end: zero(start + (fill.side === 'B' ? size : -size)),
    size, price, pnl, fee, time, tid }
}

export function reconcileFill(positionSize, fill) {
  if (Math.abs(positionSize - fill.start) > EPSILON) throw new Error(`${fill.coin} 仓位与成交不一致，请人工核对`)
  const before = zero(fill.start)
  const after = zero(fill.end)
  if (before === 0) return { kind: 'open', after, closeSize: 0, openSize: Math.abs(after) }
  if (after === 0) return { kind: 'close', after, closeSize: Math.abs(before), openSize: 0 }
  if (Math.sign(before) !== Math.sign(after)) return { kind: 'reverse', after, closeSize: Math.abs(before), openSize: Math.abs(after) }
  if (Math.abs(after) > Math.abs(before)) return { kind: 'increase', after, closeSize: 0, openSize: Math.abs(after - before) }
  return { kind: 'reduce', after, closeSize: Math.abs(before - after), openSize: 0 }
}
