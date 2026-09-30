import { useEffect, useRef, useState } from 'react'
import { api } from '../hooks/useApi'
import { getExecutionTags } from '../lib/journal'
import TradeForm from './TradeForm'
import { GlassButton, GlassSurface } from './ui/Glass'

export default function ReviewOverlay({ trade, position, total, pairs, weekGoal, onClose, onNavigate, onSave }) {
  const [images, setImages] = useState([])
  const [imageIndex, setImageIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const previousTradeId = useRef(null)
  const navigate = async target => {
    if (isNavigating || target < 0 || target >= total) return
    setIsNavigating(true)
    try { await onNavigate(target) }
    finally { setIsNavigating(false) }
  }

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
      if (isEditing || isNavigating) return
      if (event.key === 'ArrowLeft') navigate(position - 1)
      if (event.key === 'ArrowRight') navigate(position + 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNavigate, position, isEditing, isNavigating])

  if (!trade) return null
  const hasR = trade.result_r != null
  const hasDollars = trade.gross_pnl != null
  const tags = getExecutionTags(trade)
  return <div role="dialog" aria-modal="true" aria-label="逐笔复盘" className="journal-review fixed inset-0 z-[70] text-text overflow-y-auto">
    <div className="journal-review-header sticky top-0 z-10 border-b border-border px-4 py-3 flex items-center justify-between gap-3">
      <div><h2 className="font-bold">逐笔复盘</h2><p className="text-xs text-muted">第 {position + 1} / {total} 笔 · 按左右方向键切换</p></div>
      <GlassButton onClick={onClose}>关闭 ×</GlassButton>
    </div>
    <div className="journal-review-content">
      <div className="journal-review-switcher mb-4">
        <GlassButton disabled={isEditing || isNavigating || position === 0} onClick={() => navigate(position - 1)}>← 上一笔</GlassButton>
        <div className="journal-review-identity text-center"><div className="font-semibold">{trade.pair} · {trade.direction?.startsWith('多') ? 'Long' : 'Short'}</div><div className="text-xs text-muted">{trade.open_time?.replace('T', ' ')}</div></div>
        <GlassButton disabled={isEditing || isNavigating || position === total - 1} onClick={() => navigate(position + 1)}>下一笔 →</GlassButton>
      </div>
      <div className="space-y-4">
        <GlassSurface as="section" className="p-3">
          {images.length ? <>
            <div className="min-h-64 sm:min-h-[420px] flex items-center justify-center bg-black/20 rounded-lg"><img src={`/api/journal/${trade.id}/images/${images[imageIndex].id}`} alt={`第 ${imageIndex + 1} 张交易截图`} className="journal-review-image" /></div>
            <div className="flex items-center justify-between mt-3 text-sm"><button disabled={imageIndex === 0} onClick={() => setImageIndex(value => value - 1)} className="cursor-pointer disabled:opacity-40">‹ 上一张</button><span>{imageIndex + 1} / {images.length}</span><button disabled={imageIndex === images.length - 1} onClick={() => setImageIndex(value => value + 1)} className="cursor-pointer disabled:opacity-40">下一张 ›</button></div>
          </> : <div className="min-h-64 sm:min-h-[420px] flex items-center justify-center text-sm text-muted">这笔交易还没有截图</div>}
        </GlassSurface>
        {isEditing ? <section className="space-y-3">
          <TradeForm key={trade.id} initial={trade} pairs={pairs} weekGoal={weekGoal} onSave={async (form, pending) => { await onSave(form, pending); setIsEditing(false) }} onCancel={() => setIsEditing(false)} />
        </section> : <GlassSurface as="section" className="p-5 sm:p-6 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-2"><strong>{[trade.market_environment, trade.setup].filter(Boolean).join(' · ') || trade.strategy || '交易判断'}</strong><span className="text-right">{hasR && <span className={trade.result_r >= 0 ? 'text-green' : 'text-red'}>{trade.result_r > 0 ? '+' : ''}{trade.result_r}R</span>}{hasR && hasDollars && ' · '}{hasDollars && <span className={trade.gross_pnl >= 0 ? 'text-green' : 'text-red'}>{trade.gross_pnl > 0 ? '+' : ''}${Number(trade.gross_pnl).toFixed(2)}</span>}{!hasR && !hasDollars && <span className="text-muted">进行中</span>}</span></div>
          <div><div className="text-xs text-muted mb-1">入场理由</div><p className="whitespace-pre-wrap">{trade.entry_reason || trade.notes || '—'}</p></div>
          <div><div className="text-xs text-muted mb-1">失效条件</div><p className="whitespace-pre-wrap">{trade.invalidation || '—'}</p></div>
          <div><div className="text-xs text-muted mb-1">退出原因</div><p>{trade.exit_reason || '—'}</p></div>
          {trade.execution_note && <div><div className="text-xs text-muted mb-1">平仓说明</div><p className="whitespace-pre-wrap">{trade.execution_note}</p></div>}
          {trade.risk_plan && <div><div className="text-xs text-muted mb-1">旧版风控记录</div><p className="whitespace-pre-wrap">{trade.risk_plan}</p></div>}
          {trade.source === 'hyperliquid' && <div><div className="text-xs text-muted mb-1">Hyperliquid 同步数据</div><p>{trade.status === 'open' ? `进行中 · 持仓 ${Math.abs(Number(trade.source_position_size || 0))}` : '已平仓'} · 入场 {trade.entry ?? '—'} · 出场 {trade.exit_price ?? '—'} · 已实现 {Number(trade.source_realized_pnl || 0).toFixed(2)} USDC · 已观察手续费 {Number(trade.source_fee_usd || 0).toFixed(2)} USDC</p>{trade.source_sync_note && <p className="text-muted mt-1">{trade.source_sync_note}</p>}</div>}
          <div><div className="text-xs text-muted mb-1">执行评价</div><p>{tags.length ? tags.join(' / ') : trade.score ? `旧评分 ${trade.score}` : '尚未评价'}{trade.good_trade != null && ` · 遮住盈亏仍是好交易：${trade.good_trade ? '是' : '否'}`}</p></div>
          <GlassButton onClick={() => setIsEditing(true)}>编辑这笔交易</GlassButton>
        </GlassSurface>}
      </div>
    </div>
  </div>
}
