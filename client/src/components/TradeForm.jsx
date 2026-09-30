import { useEffect, useRef, useState } from 'react'
import { api } from '../hooks/useApi'
import { EXIT_REASONS, EXECUTION_TAGS, getExecutionTags } from '../lib/journal'

const environments = ['趋势', '区间', '突破', '趋势末端']
const setups = ['突破', '突破回踩', 'Vegas回调', 'H2/L2', '其他']
const imageTypes = ['image/png', 'image/jpeg', 'image/webp']

function localTime() {
  const date = new Date()
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function emptyTrade(pairs = []) {
  return {
    open_time: localTime(), pair: pairs[0] || 'XAUUSD', direction: '多(Buy)',
    market_environment: '', setup: '', entry_reason: '', invalidation: '',
    exit_reason: '', execution_note: '', execution_tags: [],
    result_r: '', gross_pnl: '', good_trade: null,
  }
}

function initialForm(initial, pairs) {
  if (!initial) return emptyTrade(pairs)
  return {
    open_time: initial.open_time?.slice(0, 16) || localTime(),
    pair: initial.pair || pairs[0] || 'XAUUSD', direction: initial.direction || '多(Buy)',
    market_environment: initial.market_environment || '',
    setup: initial.setup || '',
    entry_reason: initial.entry_reason || initial.notes || '',
    invalidation: initial.invalidation || '',
    exit_reason: initial.exit_reason || '',
    execution_note: initial.execution_note || '',
    execution_tags: getExecutionTags(initial),
    result_r: initial.result_r ?? '',
    gross_pnl: initial.gross_pnl ?? '',
    good_trade: initial.good_trade == null ? null : Boolean(initial.good_trade),
  }
}

const inputClass = 'w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-text outline-none focus:border-accent'

export default function TradeForm({ initial, pairs = [], weekGoal, onSave, onCancel }) {
  const [form, setForm] = useState(() => initialForm(initial, pairs))
  const [pending, setPending] = useState([])
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pendingRef = useRef([])

  useEffect(() => () => pendingRef.current.forEach(item => URL.revokeObjectURL(item.url)), [])
  useEffect(() => {
    if (initial?.id) api.getJournalImages(initial.id).then(setImages).catch(() => setImages([]))
  }, [initial?.id])

  const change = (field, value) => {
    setForm(current => {
      const next = { ...current, [field]: value }
      if ((field === 'result_r' || field === 'gross_pnl') && next.result_r === '' && next.gross_pnl === '') {
        next.good_trade = null
      }
      return next
    })
    setError('')
  }
  const toggleTag = tag => {
    setForm(current => ({ ...current, execution_tags: current.execution_tags.includes(tag)
      ? current.execution_tags.filter(item => item !== tag)
      : [...current.execution_tags, tag] }))
    setError('')
  }
  const addFiles = files => {
    const selected = [...files]
    if (selected.some(file => !imageTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('图片仅支持 PNG、JPEG、WebP，单张不超过 5 MB')
      return
    }
    if (pending.length + images.length + selected.length > 8) {
      setError('每笔交易最多保存 8 张图片')
      return
    }
    const next = selected.map(file => ({ file, url: URL.createObjectURL(file) }))
    pendingRef.current.push(...next)
    setPending(current => [...current, ...next])
  }
  const onPaste = event => {
    const files = [...event.clipboardData.items].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean)
    if (files.length) { event.preventDefault(); addFiles(files) }
  }
  const removePending = item => {
    URL.revokeObjectURL(item.url)
    pendingRef.current = pendingRef.current.filter(current => current !== item)
    setPending(current => current.filter(candidate => candidate !== item))
  }
  const removeImage = async imageId => {
    try { await api.deleteJournalImage(initial.id, imageId); setImages(current => current.filter(image => image.id !== imageId)) }
    catch (cause) { setError(cause.message) }
  }
  const submit = async event => {
    event.preventDefault()
    if (!form.entry_reason.trim() || !form.invalidation.trim()) return setError('请填写入场理由和失效条件')
    const hasResult = form.result_r !== '' || form.gross_pnl !== ''
    if (hasResult && (!form.exit_reason || !form.execution_tags.length || form.good_trade == null)) return setError('结束交易时请填写退出原因、执行评价，并回答是否为好交易')
    if (hasResult && (form.exit_reason === '手动平仓' || form.execution_tags.includes('提前平仓')) && !form.execution_note.trim()) return setError('请写明提前或手动平仓的原因')
    setSaving(true)
    try { await onSave(form, pending.map(item => item.file)) }
    catch (cause) { setError(cause.message || '保存失败，请重试') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} onPaste={onPaste} className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold">{initial?.id ? '编辑交易' : '记一笔交易'}</h2>
        <p className="text-xs text-muted mt-1">先写判断，结束后再补结果。核心是入场理由、失效条件和执行评价。</p>
      </div>
      {weekGoal && <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-sm"><span className="text-accent font-semibold">本周目标 · </span>{weekGoal}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted">① 时间<input className={`${inputClass} mt-1`} type="datetime-local" value={form.open_time} onChange={event => change('open_time', event.target.value)} required /></label>
        <label className="text-xs text-muted">品种<select className={`${inputClass} mt-1`} value={form.pair} onChange={event => change('pair', event.target.value)}>{[...new Set([form.pair, ...pairs])].map(pair => <option key={pair}>{pair}</option>)}</select></label>
      </div>
      <div>
        <div className="text-xs text-muted mb-2">② 方向</div>
        <div className="flex gap-2">{[['多(Buy)', 'Long'], ['空(Sell)', 'Short']].map(([value, label]) => <button key={value} type="button" onClick={() => change('direction', value)} className={`rounded-xl px-5 py-2 text-sm border cursor-pointer ${form.direction === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}>{label}</button>)}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted">③ 市场环境<select className={`${inputClass} mt-1`} value={form.market_environment} onChange={event => change('market_environment', event.target.value)}><option value="">请选择</option>{environments.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-muted">④ Setup<select className={`${inputClass} mt-1`} value={form.setup} onChange={event => change('setup', event.target.value)}><option value="">请选择</option>{setups.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <label className="block text-xs text-muted font-semibold">⑤ 入场理由 <span className="text-red">*</span><textarea className={`${inputClass} mt-1 min-h-16 resize-y`} value={form.entry_reason} onChange={event => change('entry_reason', event.target.value)} placeholder="1H 多头 + 15M 回调 Vegas + 突破前高收盘确认" maxLength={2000} /></label>
      <label className="block text-xs text-muted font-semibold">⑥ 失效条件 <span className="text-red">*</span><textarea className={`${inputClass} mt-1 min-h-16 resize-y`} value={form.invalidation} onChange={event => change('invalidation', event.target.value)} placeholder="15M 重新收回区间 / 跌破起涨点" maxLength={2000} /></label>
      <div>
        <label className="block text-xs text-muted font-semibold">⑦ 退出原因<select className={`${inputClass} mt-1`} value={form.exit_reason} onChange={event => change('exit_reason', event.target.value)}><option value="">结束后选择</option>{EXIT_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}</select></label>
        {(form.exit_reason === '手动平仓' || form.execution_tags.includes('提前平仓')) && <label className="block text-xs text-muted mt-3">为什么提前或手动平仓？<textarea className={`${inputClass} mt-1 min-h-16 resize-y`} value={form.execution_note} onChange={event => change('execution_note', event.target.value)} placeholder="当时看到了什么、为什么没有继续按原计划持有？" maxLength={2000} /></label>}
      </div>
      <div><div className="text-xs text-muted font-semibold mb-2">⑧ 最终结果（结束后填写）</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs text-muted">R<input className={`${inputClass} mt-1`} type="number" step="any" value={form.result_r} onChange={event => change('result_r', event.target.value)} placeholder="+2.3" /></label><label className="text-xs text-muted">美元盈亏<input className={`${inputClass} mt-1`} type="number" step="any" value={form.gross_pnl} onChange={event => change('gross_pnl', event.target.value)} placeholder="+235" /></label></div></div>
      <div><div className="text-xs text-muted font-semibold mb-2">⑨ 执行评价（可多选）</div><div className="flex flex-wrap gap-2">{EXECUTION_TAGS.map(tag => <button key={tag} type="button" aria-pressed={form.execution_tags.includes(tag)} onClick={() => toggleTag(tag)} className={`rounded-lg border px-3 py-2 text-sm cursor-pointer ${form.execution_tags.includes(tag) ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}>{tag}</button>)}</div></div>
      {(form.result_r !== '' || form.gross_pnl !== '') && <div className="rounded-xl border border-border p-4">
        <div className="text-sm font-medium mb-3">如果把盈亏结果遮住，这仍是一笔好交易吗？</div>
        <div className="flex gap-2">{[[true, '是'], [false, '否']].map(([value, label]) => <button type="button" key={label} onClick={() => change('good_trade', value)} className={`px-5 py-2 rounded-lg border text-sm cursor-pointer ${form.good_trade === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}>{label}</button>)}</div>
      </div>}
      <div className="rounded-xl border border-dashed border-border p-4" tabIndex={0}>
        <div className="text-sm font-medium">交易截图</div>
        <p className="text-xs text-muted mt-1 mb-3">在表单中按 Ctrl+V 粘贴截图，或选择图片；每张不超过 5 MB。</p>
        <label className="inline-block border border-border rounded-lg px-3 py-2 text-xs cursor-pointer">选择图片<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={event => { addFiles(event.target.files || []); event.target.value = '' }} /></label>
        {(images.length > 0 || pending.length > 0) && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {images.map(image => <div key={image.id} className="relative"><img className="w-full h-28 object-cover rounded-lg" src={`/api/journal/${initial.id}/images/${image.id}`} alt="交易截图" /><button type="button" onClick={() => removeImage(image.id)} className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 cursor-pointer">删除</button></div>)}
          {pending.map(item => <div key={item.url} className="relative"><img className="w-full h-28 object-cover rounded-lg" src={item.url} alt="待保存截图" /><button type="button" onClick={() => removePending(item)} className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 cursor-pointer">移除</button></div>)}
        </div>}
      </div>
      {error && <p className="text-red text-sm" role="alert">{error}</p>}
      <div className="flex gap-3"><button disabled={saving} className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50">{saving ? '保存中…' : '保存交易'}</button><button type="button" onClick={onCancel} className="border border-border rounded-xl px-5 py-2.5 text-sm cursor-pointer">取消</button></div>
    </form>
  )
}
