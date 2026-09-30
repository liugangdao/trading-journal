import { useEffect, useRef, useState } from 'react'
import { api } from '../hooks/useApi'
import { getExecutionTags } from '../lib/journal'
import TradeForm from './TradeForm'
import LegacyTradeForm from './LegacyTradeForm'
import TradeImageEditor from './TradeImageEditor'

export default function ReviewOverlay({ trades, initialId, pairs, weekGoal, onClose, onSaveQuick, onSaveLegacy }) {
  const [activeId, setActiveId] = useState(initialId)
  const [images, setImages] = useState([])
  const [imageIndex, setImageIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const previousTradeId = useRef(null)
  const index = Math.max(0, trades.findIndex(trade => trade.id === activeId))
  const trade = trades[index]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  useEffect(() => {
    if (!trade) return
    let active = true
    if (previousTradeId.current !== trade.id) {
      setImages([])
      setImageIndex(0)
      previousTradeId.current = trade.id
    }
    api.getJournalImages(trade.id).then(result => {
      if (active) { setImages(result); setImageIndex(current => Math.min(current, Math.max(0, result.length - 1))) }
    }).catch(() => { if (active) setImages([]) })
    return () => { active = false }
  }, [trade?.id, isEditing])
  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape') { if (isEditing) setIsEditing(false); else onClose() }
      if (isEditing) return
      if (event.key === 'ArrowLeft') setActiveId(trades[Math.max(0, index - 1)]?.id)
      if (event.key === 'ArrowRight') setActiveId(trades[Math.min(trades.length - 1, index + 1)]?.id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, trades, index, isEditing])

  if (!trade) return null
  const hasR = trade.result_r != null
  const hasDollars = trade.gross_pnl != null
  const tags = getExecutionTags(trade)
  return <div role="dialog" aria-modal="true" aria-label="逐笔复盘" className="fixed inset-0 z-[70] bg-bg text-text overflow-y-auto">
    <div className="sticky top-0 z-10 bg-header-bg border-b border-border px-4 py-3 flex items-center justify-between gap-3">
      <div><h2 className="font-bold">逐笔复盘</h2><p className="text-xs text-muted">第 {index + 1} / {trades.length} 笔 · 按左右方向键切换</p></div>
      <button onClick={onClose} className="text-sm border border-border rounded-lg px-3 py-2 cursor-pointer">关闭 ×</button>
    </div>
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <button disabled={isEditing || index === 0} onClick={() => setActiveId(trades[index - 1].id)} className="border border-border rounded-lg px-3 py-2 text-sm cursor-pointer disabled:opacity-40">← 上一笔</button>
        <div className="text-center"><div className="font-semibold">{trade.pair} · {trade.direction?.startsWith('多') ? 'Long' : 'Short'}</div><div className="text-xs text-muted">{trade.open_time?.replace('T', ' ')}</div></div>
        <button disabled={isEditing || index === trades.length - 1} onClick={() => setActiveId(trades[index + 1].id)} className="border border-border rounded-lg px-3 py-2 text-sm cursor-pointer disabled:opacity-40">下一笔 →</button>
      </div>
      <div className="space-y-4">
        <section className="bg-card border border-border rounded-xl p-3">
          {images.length ? <>
            <div className="min-h-64 sm:min-h-[420px] flex items-center justify-center bg-black/20 rounded-lg"><img src={`/api/journal/${trade.id}/images/${images[imageIndex].id}`} alt={`第 ${imageIndex + 1} 张交易截图`} className="max-w-full max-h-[65vh] object-contain" /></div>
            <div className="flex items-center justify-between mt-3 text-sm"><button disabled={imageIndex === 0} onClick={() => setImageIndex(value => value - 1)} className="cursor-pointer disabled:opacity-40">‹ 上一张</button><span>{imageIndex + 1} / {images.length}</span><button disabled={imageIndex === images.length - 1} onClick={() => setImageIndex(value => value + 1)} className="cursor-pointer disabled:opacity-40">下一张 ›</button></div>
          </> : <div className="min-h-64 sm:min-h-[420px] flex items-center justify-center text-sm text-muted">这笔交易还没有截图</div>}
        </section>
        {isEditing ? <section className="space-y-3">
          {trade.entry_reason || trade.source === 'hyperliquid' ? <TradeForm key={trade.id} initial={trade} pairs={pairs} weekGoal={weekGoal} onSave={async (form, pending) => { await onSaveQuick(trade, form, pending); setIsEditing(false) }} onCancel={() => setIsEditing(false)} />
            : <><LegacyTradeForm key={trade.id} initial={trade} editing mode="edit" pairs={pairs} policies={[]} initialViolations={[]} onSubmit={async form => { if (await onSaveLegacy(trade, form)) setIsEditing(false) }} onCancel={() => setIsEditing(false)} /><TradeImageEditor tradeId={trade.id} onChanged={() => api.getJournalImages(trade.id).then(result => { setImages(result); setImageIndex(current => Math.min(current, Math.max(0, result.length - 1))) }).catch(() => {})} /></>}
        </section> : <section className="bg-card border border-border rounded-xl p-5 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-2"><strong>{[trade.market_environment, trade.setup].filter(Boolean).join(' · ') || trade.strategy || '交易判断'}</strong><span className="text-right">{hasR && <span className={trade.result_r >= 0 ? 'text-green' : 'text-red'}>{trade.result_r > 0 ? '+' : ''}{trade.result_r}R</span>}{hasR && hasDollars && ' · '}{hasDollars && <span className={trade.gross_pnl >= 0 ? 'text-green' : 'text-red'}>{trade.gross_pnl > 0 ? '+' : ''}${Number(trade.gross_pnl).toFixed(2)}</span>}{!hasR && !hasDollars && <span className="text-muted">进行中</span>}</span></div>
          <div><div className="text-xs text-muted mb-1">入场理由</div><p className="whitespace-pre-wrap">{trade.entry_reason || trade.notes || '—'}</p></div>
          <div><div className="text-xs text-muted mb-1">失效条件</div><p className="whitespace-pre-wrap">{trade.invalidation || '—'}</p></div>
          <div><div className="text-xs text-muted mb-1">退出原因</div><p>{trade.exit_reason || '—'}</p></div>
          {trade.execution_note && <div><div className="text-xs text-muted mb-1">平仓说明</div><p className="whitespace-pre-wrap">{trade.execution_note}</p></div>}
          {trade.risk_plan && <div><div className="text-xs text-muted mb-1">旧版风控记录</div><p className="whitespace-pre-wrap">{trade.risk_plan}</p></div>}
          {trade.source === 'hyperliquid' && <div><div className="text-xs text-muted mb-1">Hyperliquid 同步数据</div><p>{trade.status === 'open' ? `进行中 · 持仓 ${Math.abs(Number(trade.source_position_size || 0))}` : '已平仓'} · 入场 {trade.entry ?? '—'} · 出场 {trade.exit_price ?? '—'} · 已实现 {Number(trade.source_realized_pnl || 0).toFixed(2)} USDC · 已观察手续费 {Number(trade.source_fee_usd || 0).toFixed(2)} USDC</p>{trade.source_sync_note && <p className="text-muted mt-1">{trade.source_sync_note}</p>}</div>}
          {!trade.entry_reason && trade.source !== 'hyperliquid' && <div><div className="text-xs text-muted mb-1">原有交易明细</div><p>入场 {trade.entry ?? '—'} · 出场 {trade.exit_price ?? '—'} · 盈亏 {trade.gross_pnl ?? '—'}</p></div>}
          <div><div className="text-xs text-muted mb-1">执行评价</div><p>{tags.length ? tags.join(' / ') : trade.score ? `旧评分 ${trade.score}` : '尚未评价'}{trade.good_trade != null && ` · 遮住盈亏仍是好交易：${trade.good_trade ? '是' : '否'}`}</p></div>
          <button onClick={() => setIsEditing(true)} className="text-accent text-sm cursor-pointer">编辑这笔交易</button>
        </section>}
      </div>
    </div>
  </div>
}
