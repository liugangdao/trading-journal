import { SPREAD_COST, WEEKDAYS } from './constants'

const weekday = (d) => WEEKDAYS[new Date(d).getDay()]

export function calcTrade(t, spreadCostMap) {
  const costMap = spreadCostMap || SPREAD_COST
  const entry = parseFloat(t.entry) || 0
  const stop = parseFloat(t.stop) || 0
  const exitPrice = parseFloat(t.exit_price) || 0
  const lots = parseFloat(t.lots) || 0
  const gross = parseFloat(t.gross_pnl) || 0
  const swap = parseFloat(t.swap) || 0
  const isBuy = t.direction.startsWith("多")

  const stopPips = stop > 0 ? Math.abs(entry - stop) : 0
  const pnlPips = isBuy ? exitPrice - entry : entry - exitPrice
  const rMultiple = stopPips > 0 ? pnlPips / stopPips : 0
  const spread = (costMap[t.pair] || 5) * lots
  const netPnl = gross - spread + swap

  return {
    ...t,
    weekday: weekday(t.date),
    stopPips,
    pnlPips,
    rMultiple: Math.round(rMultiple * 100) / 100,
    spread: Math.round(spread * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
  }
}

export function calcStats(trades, spreadCostMap) {
  const computed = trades.map(t => calcTrade(t, spreadCostMap))
  if (computed.length === 0) return null

  const wins = computed.filter(t => t.netPnl > 0)
  const losses = computed.filter(t => t.netPnl < 0)
  const totalNet = computed.reduce((s, t) => s + t.netPnl, 0)
  const totalGross = computed.reduce((s, t) => s + (parseFloat(t.gross_pnl) || 0), 0)
  const totalSpread = computed.reduce((s, t) => s + t.spread, 0)
  const totalSwap = computed.reduce((s, t) => s + (parseFloat(t.swap) || 0), 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length : 0

  const byPair = {}; const byStrat = {}; const byEmo = {}; const byDay = {}; const byTf = {}
  computed.forEach(t => {
    for (const [map, key] of [[byPair, t.pair],[byStrat, t.strategy],[byEmo, t.emotion],[byDay, t.weekday],[byTf, t.timeframe]]) {
      if (!map[key]) map[key] = { count: 0, wins: 0, totalPnl: 0, totalR: 0 }
      map[key].count++
      if (t.netPnl > 0) map[key].wins++
      map[key].totalPnl += t.netPnl
      map[key].totalR += t.rMultiple
    }
  })

  const toArr = (m) => Object.entries(m).map(([k, v]) => ({
    name: k, count: v.count,
    winRate: v.count ? Math.round(v.wins / v.count * 1000) / 10 : 0,
    pnl: Math.round(v.totalPnl * 100) / 100,
    avgR: v.count ? Math.round(v.totalR / v.count * 100) / 100 : 0
  }))

  let cumPnl = 0
  const sorted = [...computed].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const cumData = sorted.map((t, i) => { cumPnl += t.netPnl; return { idx: i + 1, date: t.date, pnl: Math.round(cumPnl * 100) / 100 } })

  return {
    total: computed.length, wins: wins.length, losses: losses.length,
    winRate: Math.round(wins.length / computed.length * 1000) / 10,
    totalNet: Math.round(totalNet * 100) / 100,
    totalGross: Math.round(totalGross * 100) / 100,
    totalSpread: Math.round(totalSpread * 100) / 100,
    totalSwap: Math.round(totalSwap * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: avgLoss !== 0 ? Math.round(Math.abs(avgWin / avgLoss) * 100) / 100 : 0,
    avgR: Math.round(computed.reduce((s, t) => s + t.rMultiple, 0) / computed.length * 100) / 100,
    byPair: toArr(byPair).sort((a, b) => b.pnl - a.pnl),
    byStrat: toArr(byStrat).sort((a, b) => b.pnl - a.pnl),
    byEmo: toArr(byEmo).filter(x => x.count > 0),
    byDay: toArr(byDay),
    byTf: toArr(byTf).filter(x => x.count > 0),
    cumData,
    computed,
  }
}
