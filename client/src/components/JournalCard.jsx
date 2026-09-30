import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { getExecutionTags } from '../lib/journal'

export default function JournalCard({ trade, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [images, setImages] = useState([])
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (expanded) api.getJournalImages(trade.id).then(setImages).catch(() => setImages([]))
  }, [expanded, trade.id])
  const hasR = trade.result_r != null
  const hasDollars = trade.gross_pnl != null
  const tags = getExecutionTags(trade)
  const evaluation = tags.length ? tags.join(' / ') : trade.score ? `旧评分 ${trade.score}` : ''
  return <article className="bg-card border border-border rounded-xl p-4">
    <button type="button" onClick={() => setExpanded(value => !value)} className="w-full text-left cursor-pointer">
      <div className="flex items-center justify-between gap-3">
        <div><span className="font-semibold">{trade.pair}</span><span className="ml-2 text-xs text-muted">{trade.direction?.startsWith('多') ? 'Long' : 'Short'} · {trade.open_time?.replace('T', ' ')}</span></div>
        <span className="text-right text-sm font-semibold">{hasR && <span className={trade.result_r >= 0 ? 'text-green' : 'text-red'}>{trade.result_r > 0 ? '+' : ''}{trade.result_r}R</span>}{hasR && hasDollars && <span className="text-muted mx-1">·</span>}{hasDollars && <span className={trade.gross_pnl >= 0 ? 'text-green' : 'text-red'}>{trade.gross_pnl > 0 ? '+' : ''}${Number(trade.gross_pnl).toFixed(2)}</span>}{!hasR && !hasDollars && <span className="text-muted">{trade.status === 'missed' ? '踏空' : '进行中'}</span>}</span>
      </div>
      <div className="text-xs text-muted mt-2">{[trade.market_environment, trade.setup].filter(Boolean).join(' · ') || trade.strategy || '—'}{evaluation && ` · 执行 ${evaluation}`}{trade.image_count ? ` · ${trade.image_count} 张图` : ''}</div>
    </button>
    {expanded && <div className="border-t border-border mt-4 pt-4 space-y-3 text-sm">
      <p><span className="text-muted">入场理由：</span>{trade.entry_reason || trade.notes || '—'}</p>
      <p><span className="text-muted">失效条件：</span>{trade.invalidation || '—'}</p>
      <p><span className="text-muted">退出原因：</span>{trade.exit_reason || '—'}</p>
      {trade.execution_note && <p><span className="text-muted">平仓说明：</span>{trade.execution_note}</p>}
      {trade.risk_plan && <p><span className="text-muted">旧版风控记录：</span>{trade.risk_plan}</p>}
      {!trade.entry_reason && <p><span className="text-muted">旧版明细：</span>入场 {trade.entry ?? '—'} · 止损 {trade.stop ?? '—'} · 出场 {trade.exit_price ?? '—'} · 盈亏 {trade.gross_pnl ?? '—'}</p>}
      {trade.good_trade != null && <p><span className="text-muted">遮住盈亏仍是好交易：</span>{trade.good_trade ? '是' : '否'}</p>}
      {images.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{images.map(image => <button key={image.id} type="button" onClick={() => setPreview(image.id)} className="cursor-zoom-in"><img src={`/api/journal/${trade.id}/images/${image.id}`} alt="交易截图" className="w-full h-28 rounded-lg object-cover" /></button>)}</div>}
      <div className="flex gap-4 pt-1"><button onClick={() => onEdit(trade)} className="text-accent text-xs cursor-pointer">编辑</button><button onClick={() => onDelete(trade.id)} className="text-red text-xs cursor-pointer">删除</button></div>
    </div>}
    {preview && <div role="dialog" aria-label="查看交易截图" className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4" onClick={() => setPreview(null)}><button className="absolute top-4 right-5 text-white text-sm cursor-pointer" onClick={() => setPreview(null)}>关闭 ×</button><img src={`/api/journal/${trade.id}/images/${preview}`} alt="交易截图大图" className="max-h-full max-w-full object-contain" /></div>}
  </article>
}
