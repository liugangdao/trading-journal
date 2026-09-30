import { calcTrade } from './calc'
import { getExecutionTags } from './journal'

const round = value => Math.round(value * 100) / 100

export function calcRStats(trades) {
  const closed = trades.filter(trade => trade.status === 'closed')
  const withR = closed.map(trade => ({ ...trade, r: calcTrade(trade).rMultiple }))
    .filter(trade => Number.isFinite(trade.r))
    .sort((a, b) => a.open_time.localeCompare(b.open_time) || a.id - b.id)
  const wins = withR.filter(trade => trade.r > 0)
  const losses = withR.filter(trade => trade.r < 0)
  const count = withR.length
  const winRate = count ? wins.length / count : 0
  const lossRate = count ? losses.length / count : 0
  const avgWinningR = wins.length ? wins.reduce((sum, trade) => sum + trade.r, 0) / wins.length : 0
  const avgLosingR = losses.length ? -losses.reduce((sum, trade) => sum + trade.r, 0) / losses.length : 0
  const expectancy = winRate * avgWinningR - lossRate * avgLosingR

  const evaluated = closed.filter(trade => getExecutionTags(trade).length || trade.score)
  const violations = evaluated.filter(trade => {
    const tags = getExecutionTags(trade)
    if (tags.length) return tags.some(tag => tag !== '计划内')
    return /^[CD]/.test(trade.score || '')
  }).length

  const days = new Map()
  for (const trade of withR) {
    const date = trade.open_time.slice(0, 10)
    const day = days.get(date) || { date, count: 0, sumR: 0 }
    day.count++
    day.sumR += trade.r
    days.set(date, day)
  }
  let cumulativeCount = 0
  let cumulativeR = 0
  const dailyExpectancy = [...days.values()].map(day => {
    cumulativeCount += day.count
    cumulativeR += day.sumR
    return { date: day.date, count: day.count, daily: round(day.sumR / day.count), cumulative: round(cumulativeR / cumulativeCount) }
  })

  return {
    count, wins: wins.length, losses: losses.length,
    winRate: round(winRate * 100), lossRate: round(lossRate * 100),
    avgWinningR: round(avgWinningR), avgLosingR: round(avgLosingR),
    expectancy: round(expectancy), totalR: round(withR.reduce((sum, trade) => sum + trade.r, 0)),
    evaluatedCount: evaluated.length, violations,
    violationRate: evaluated.length ? round(violations / evaluated.length * 100) : null,
    dailyExpectancy,
  }
}
