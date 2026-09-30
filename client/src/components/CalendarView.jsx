import JournalCard from './JournalCard'

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

export default function CalendarView({ month, trades, selectedDay, onSelectDay, onMonthChange, onEdit, onDelete }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(year, monthNumber - 1, 1)
  const days = new Date(year, monthNumber, 0).getDate()
  const leading = (first.getDay() + 6) % 7
  const byDay = Object.groupBy
    ? Object.groupBy(trades, trade => trade.open_time?.slice(0, 10))
    : trades.reduce((result, trade) => { const day = trade.open_time?.slice(0, 10); (result[day] ||= []).push(trade); return result }, {})
  const completed = trades.filter(trade => trade.status === 'closed')
  const totalR = trades.reduce((sum, trade) => sum + (trade.result_r == null ? 0 : Number(trade.result_r)), 0)
  const totalDollars = trades.reduce((sum, trade) => sum + (trade.gross_pnl == null ? 0 : Number(trade.gross_pnl)), 0)
  const changeMonth = direction => {
    const next = new Date(year, monthNumber - 1 + direction, 1)
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold">交易日历</h2><div className="flex items-center gap-3"><button onClick={() => changeMonth(-1)} aria-label="上个月" className="px-3 py-1.5 border border-border rounded-lg cursor-pointer">‹</button><span className="text-sm font-semibold">{year} 年 {monthNumber} 月</span><button onClick={() => changeMonth(1)} aria-label="下个月" className="px-3 py-1.5 border border-border rounded-lg cursor-pointer">›</button></div></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">{[[trades.length, '本月交易'], [completed.length, '已结束'], [`${totalR > 0 ? '+' : ''}${Number(totalR.toFixed(2))}R`, 'R 合计'], [`${totalDollars > 0 ? '+' : ''}$${totalDollars.toFixed(2)}`, '美元盈亏合计']].map(([value, label]) => <div key={label} className="bg-card border border-border rounded-xl p-3"><div className="font-semibold">{value}</div><div className="text-xs text-muted mt-1">{label}</div></div>)}</div>
    <div className="bg-card border border-border rounded-xl p-2 sm:p-4">
      <div className="grid grid-cols-7 text-center text-xs text-muted mb-1">{weekdays.map(day => <div key={day} className="py-2">{day}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">{Array.from({ length: leading }, (_, index) => <div key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`
        const dayTrades = byDay[date] || []
        const dayR = dayTrades.reduce((sum, trade) => sum + (trade.result_r == null ? 0 : Number(trade.result_r)), 0)
        const dayDollars = dayTrades.reduce((sum, trade) => sum + (trade.gross_pnl == null ? 0 : Number(trade.gross_pnl)), 0)
        return <button key={date} type="button" onClick={() => onSelectDay(date)} className={`min-h-20 sm:min-h-24 rounded-lg p-1.5 text-left cursor-pointer border ${selectedDay === date ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-hover'}`}><span className="text-xs">{index + 1}</span>{dayTrades.length > 0 && <div className="text-[10px] mt-1 text-accent">{dayTrades.length} 笔</div>}{dayTrades.some(trade => trade.result_r != null) && <div className={`text-[10px] ${dayR >= 0 ? 'text-green' : 'text-red'}`}>{dayR > 0 ? '+' : ''}{Number(dayR.toFixed(2))}R</div>}{dayTrades.some(trade => trade.gross_pnl != null) && <div className={`text-[10px] ${dayDollars >= 0 ? 'text-green' : 'text-red'}`}>{dayDollars > 0 ? '+' : ''}${Number(dayDollars.toFixed(0))}</div>}</button>
      })}</div>
    </div>
    <section><h3 className="text-sm font-semibold mb-3">{selectedDay} · {byDay[selectedDay]?.length || 0} 笔交易</h3><div className="space-y-2">{(byDay[selectedDay] || []).map(trade => <JournalCard key={trade.id} trade={trade} onEdit={onEdit} onDelete={onDelete} />)}{!byDay[selectedDay]?.length && <p className="text-sm text-muted bg-card border border-border rounded-xl p-5">这一天还没有交易记录。</p>}</div></section>
  </div>
}
