import { useState } from 'react'
import { api } from '../hooks/useApi'

export default function ExportBar() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const handleExport = () => {
    api.exportData(from || undefined, to || undefined)
  }

  return (
    <div className="flex items-end gap-3 flex-wrap mb-5">
      <div>
        <div className="text-[11px] text-muted mb-1">起始日期</div>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="bg-input text-text border border-border rounded-lg px-3 py-1.5 text-xs outline-none
            focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
        />
      </div>
      <div>
        <div className="text-[11px] text-muted mb-1">结束日期</div>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="bg-input text-text border border-border rounded-lg px-3 py-1.5 text-xs outline-none
            focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200"
        />
      </div>
      <button
        onClick={handleExport}
        className="px-4 py-1.5 rounded-lg text-xs font-medium text-muted border border-border
          hover:text-text hover:border-accent/50 transition-all duration-200 cursor-pointer"
      >
        导出数据
      </button>
      {(from || to) && (
        <button
          onClick={() => { setFrom(''); setTo('') }}
          className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-text transition-colors cursor-pointer"
        >
          清除筛选
        </button>
      )}
    </div>
  )
}
