import { useState } from 'react'
import { api } from '../hooks/useApi'

export default function Settings({ pairs, onPairsChange }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const nextName = name.trim().toUpperCase()
    if (!nextName) return
    try {
      const created = await api.createPair({ name: nextName })
      onPairsChange([...pairs, created])
      setName('')
      setError('')
    } catch (err) { setError(err.message) }
  }

  const handleSave = async () => {
    const nextName = editName.trim().toUpperCase()
    if (!nextName) return setError('请填写品种名称')
    try {
      const updated = await api.updatePair(editingId, { name: nextName })
      onPairsChange(pairs.map(pair => pair.id === editingId ? updated : pair))
      setEditingId(null)
      setError('')
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async id => {
    try {
      await api.deletePair(id)
      onPairsChange(pairs.filter(pair => pair.id !== id))
      setError('')
    } catch (err) { setError(err.message) }
  }

  return <details className="group">
    <summary className="flex items-center justify-between cursor-pointer list-none">
      <span className="text-sm font-semibold">品种管理 <span className="font-normal text-muted">· {pairs.length} 个</span></span>
      <span className="text-xs text-muted group-open:rotate-180 transition-transform">⌄</span>
    </summary>
    <div className="mt-4 space-y-4">
      {error && <p className="text-red text-sm" role="alert">{error}</p>}
      <div className="flex gap-2">
        <input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleAdd()} placeholder="新增品种，如 XAUUSD" aria-label="新增品种名称" className="min-w-0 flex-1 bg-input text-text border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
        <button type="button" onClick={handleAdd} className="bg-accent text-white rounded-lg px-4 py-2 text-sm cursor-pointer">添加</button>
      </div>
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {pairs.map(pair => <div key={pair.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
          {editingId === pair.id ? <>
            <input value={editName} onChange={event => setEditName(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleSave()} aria-label="编辑品种名称" className="min-w-0 flex-1 bg-input text-text border border-border rounded-lg px-2 py-1 outline-none focus:border-accent" />
            <div className="flex gap-3"><button type="button" onClick={handleSave} className="text-green cursor-pointer">保存</button><button type="button" onClick={() => setEditingId(null)} className="text-muted cursor-pointer">取消</button></div>
          </> : <>
            <span className="font-medium">{pair.name}</span>
            <div className="flex gap-3"><button type="button" onClick={() => { setEditingId(pair.id); setEditName(pair.name); setError('') }} className="text-accent cursor-pointer">编辑</button><button type="button" onClick={() => handleDelete(pair.id)} className="text-red cursor-pointer">删除</button></div>
          </>}
        </div>)}
        {!pairs.length && <p className="px-3 py-4 text-sm text-muted">还没有品种，可以在上方添加。</p>}
      </div>
    </div>
  </details>
}
