import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'

const formatSyncTime = value => value
  ? new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(`${value.replace(' ', 'T')}Z`))
  : '尚未同步'

export default function HyperliquidSettings({ account, error: syncError, onChanged, onSync }) {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setAddress(account?.address || '') }, [account?.address])

  const bind = async () => {
    setBusy(true); setError('')
    try { await api.bindHyperliquid(address.trim()); await onChanged() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const unbind = async () => {
    if (!window.confirm('解绑后停止自动同步，已同步的交易仍会保留。确定解绑吗？')) return
    setBusy(true); setError('')
    try { await api.unbindHyperliquid(); await onChanged() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  const sync = async () => {
    setBusy(true); setError('')
    try { await onSync() }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <details className="bg-card border border-border rounded-xl p-4 sm:p-5">
    <summary className="text-sm font-semibold cursor-pointer">Hyperliquid 永续持仓同步</summary>
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-xs text-muted">只读取主网默认永续市场。填写实际交易账户地址即可，不需要私钥。绑定前已结束的交易不会自动导入。</p>
      <label className="block text-xs text-muted">公开账户地址<input value={address} onChange={event => setAddress(event.target.value)} placeholder="0x..." spellCheck={false} className="mt-1 w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" /></label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !/^0x[a-fA-F0-9]{40}$/.test(address.trim())} onClick={bind} className="bg-accent text-white rounded-lg px-4 py-2 text-xs cursor-pointer disabled:opacity-50">{account ? '更换地址' : '绑定并读取持仓'}</button>
        {account && <><button disabled={busy} onClick={sync} className="border border-border rounded-lg px-4 py-2 text-xs cursor-pointer disabled:opacity-50">立即同步</button><button disabled={busy} onClick={unbind} className="text-red px-3 py-2 text-xs cursor-pointer disabled:opacity-50">解绑</button></>}
      </div>
      {account && <p className="text-xs text-muted">已绑定 {account.address} · 上次同步 {formatSyncTime(account.last_synced_at)}</p>}
      {(error || syncError || account?.last_error) && <p role="alert" className="text-xs text-red">{error || syncError || account?.last_error}</p>}
      {account && <p className="text-xs text-muted">页面打开时约每 30 秒刷新一次；关闭页面后，下次打开会补齐可查询范围内的成交。</p>}
    </div>
  </details>
}
