import { calcTrade } from '../lib/calc'

const HEADERS = ["#", "Date", "Pair", "Dir", "Strategy", "TF", "Lots", "Entry", "Exit", "R", "Net PnL", "Score", "Emotion", ""]

export default function TradeTable({ trades, onEdit, onDelete }) {
  const computed = trades.map(calcTrade)

  if (computed.length === 0) {
    return (
      <div className="text-center py-20 text-muted">
        <div className="text-4xl mb-3 opacity-50">No trades yet</div>
        <p className="text-sm">Click the button above to record your first trade</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-border">
            {HEADERS.map(h => (
              <th key={h} className="px-3 py-3 text-left text-muted text-[11px] font-semibold whitespace-nowrap uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...computed].reverse().map((t, i) => (
            <tr key={t.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors duration-150">
              <td className="px-3 py-3 text-muted">{computed.length - i}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                {t.date}
                <span className="block text-[10px] text-muted">{t.weekday}</span>
              </td>
              <td className="px-3 py-3 font-semibold">{t.pair}</td>
              <td className="px-3 py-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold
                  ${t.direction.startsWith("多")
                    ? 'bg-green/10 text-green'
                    : 'bg-red/10 text-red'}`}>
                  {t.direction.startsWith("多") ? "BUY" : "SELL"}
                </span>
              </td>
              <td className="px-3 py-3 text-[11px]">{t.strategy}</td>
              <td className="px-3 py-3 text-[11px] text-muted">{t.timeframe}</td>
              <td className="px-3 py-3 font-mono">{t.lots}</td>
              <td className="px-3 py-3 font-mono text-[11px]">{t.entry}</td>
              <td className="px-3 py-3 font-mono text-[11px]">{t.exit_price}</td>
              <td className={`px-3 py-3 font-mono font-bold ${t.rMultiple >= 0 ? 'text-green' : 'text-red'}`}>
                {t.rMultiple > 0 ? "+" : ""}{t.rMultiple}R
              </td>
              <td className={`px-3 py-3 font-mono font-bold ${t.netPnl >= 0 ? 'text-green' : 'text-red'}`}>
                ${t.netPnl.toFixed(2)}
              </td>
              <td className="px-3 py-3 text-[10px]">{t.score?.split("-")[0]}</td>
              <td className="px-3 py-3 text-[10px]">{t.emotion}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <button onClick={() => onEdit(t)} className="text-accent hover:text-accent/80 cursor-pointer mr-2 transition-colors">
                  Edit
                </button>
                <button onClick={() => onDelete(t.id)} className="text-red hover:text-red/80 cursor-pointer transition-colors">
                  Del
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
