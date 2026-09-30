import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { GlassSurface } from './ui/Glass'

export default function TradeImageEditor({ tradeId, onChanged }) {
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.getJournalImages(tradeId).then(setImages).catch(cause => setError(cause.message))
  }, [tradeId])
  const addFiles = async files => {
    const selected = [...files]
    if (images.length + selected.length > 8) return setError('每笔交易最多保存 8 张图片')
    setBusy(true)
    setError('')
    try {
      for (const file of selected) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('图片仅支持 PNG、JPEG、WebP，单张不超过 5 MB')
        await api.uploadJournalImage(tradeId, file)
      }
      onChanged?.()
    } catch (cause) { setError(cause.message) }
    finally {
      api.getJournalImages(tradeId).then(setImages).catch(() => {})
      setBusy(false)
    }
  }
  const remove = async imageId => {
    try { await api.deleteJournalImage(tradeId, imageId); setImages(current => current.filter(image => image.id !== imageId)); onChanged?.() }
    catch (cause) { setError(cause.message) }
  }
  return <GlassSurface onPaste={event => {
    const files = [...event.clipboardData.items].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean)
    if (files.length) { event.preventDefault(); addFiles(files) }
  }} className="p-5 mb-5" tabIndex={0}>
    <h3 className="text-sm font-semibold">交易截图</h3>
    <p className="text-xs text-muted mt-1 mb-3">点击此处按 Ctrl+V 粘贴，或选择图片。保存后可在逐笔复盘中查看。</p>
    <label className="glass-button">{busy ? '上传中…' : '选择图片'}<input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={event => { addFiles(event.target.files || []); event.target.value = '' }} /></label>
    {error && <p className="text-red text-xs mt-2" role="alert">{error}</p>}
    {images.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">{images.map(image => <div key={image.id} className="relative"><img src={`/api/journal/${tradeId}/images/${image.id}`} alt="交易截图" className="w-full h-28 object-cover rounded-lg" /><button onClick={() => remove(image.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded px-1.5 text-xs cursor-pointer">删除</button></div>)}</div>}
  </GlassSurface>
}
