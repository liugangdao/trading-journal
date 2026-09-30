import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import KpiCard from './ui/KpiCard'
import { GlassSurface } from './ui/Glass'
import { calcRStats } from '../lib/rStats'

const colors = {
  light: { border: '#e2e8f0', muted: '#64748b', card: '#ffffff', daily: '#3b82f6', cumulative: '#16a34a' },
  dark: { border: '#1e293b', muted: '#94a3b8', card: '#111827', daily: '#60a5fa', cumulative: '#10b981' },
}

export default function RStatsPanel({ trades, theme = 'dark' }) {
  const stats = useMemo(() => calcRStats(trades), [trades])
  const palette = colors[theme] || colors.dark
  const tooltipStyle = { background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 8, fontSize: 12 }
  const signedR = value => `${value > 0 ? '+' : ''}${value.toFixed(2)}R`

  return <section className="space-y-4">
    <GlassSurface className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">R 期望</h2>
      <p className="text-xs text-muted mt-1">按已结束且有有效 R 的 {stats.count} 笔交易计算；持平交易计入总笔数。</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
        <KpiCard label="胜率" value={stats.count ? `${stats.winRate}%` : '—'} />
        <KpiCard label="平均盈利 R" value={stats.wins ? signedR(stats.avgWinningR) : '—'} />
        <KpiCard label="平均亏损 R" value={stats.losses ? `${stats.avgLosingR.toFixed(2)}R` : '—'} />
        <KpiCard label="期望值 / 笔" value={stats.count ? signedR(stats.expectancy) : '—'} color={stats.expectancy >= 0 ? palette.cumulative : '#ef4444'} />
        <KpiCard label="违规率" value={stats.violationRate == null ? '—' : `${stats.violationRate}%`} />
      </div>
      <p className="text-xs text-muted mt-4">期望值 = 胜率 × 平均盈利 R − 败率 × 平均亏损 R。当前：{stats.winRate}% × {stats.avgWinningR.toFixed(2)}R − {stats.lossRate}% × {stats.avgLosingR.toFixed(2)}R = <strong className="text-text">{signedR(stats.expectancy)}</strong></p>
      <p className="text-xs text-muted mt-1">违规率按有执行评价的 {stats.evaluatedCount} 笔计算，其中 {stats.violations} 笔含违规标签或旧评分 C/D。</p>
    </GlassSurface>
    {stats.dailyExpectancy.length > 0 && <GlassSurface className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold mb-1">期望值日曲线</h3>
      <p className="text-xs text-muted mb-4">蓝线为当天每笔平均 R，绿线为截至当天的每笔平均 R；每个交易日只显示一个点。</p>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={stats.dailyExpectancy} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
          <XAxis dataKey="date" stroke={palette.muted} fontSize={11} tickFormatter={date => date.slice(5)} />
          <YAxis stroke={palette.muted} fontSize={11} tickFormatter={value => `${value}R`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${Number(value).toFixed(2)}R`, name]} />
          <Legend />
          <Line name="当日期望" type="monotone" dataKey="daily" stroke={palette.daily} strokeWidth={2} dot={{ r: 4 }} />
          <Line name="累计期望" type="monotone" dataKey="cumulative" stroke={palette.cumulative} strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </GlassSurface>}
  </section>
}
