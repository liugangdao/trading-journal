import Tab from './ui/Tab'

export default function Layout({ tab, setTab, tradeCount, onExport, children }) {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Fixed Header with frosted glass */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#0f172a]/90 to-[#1e1b4b]/90 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">交易日志</h1>
            <p className="text-xs text-muted mt-0.5">
              外汇 &middot; 贵金属 &middot; 能源 &nbsp;|&nbsp; 已记录 {tradeCount} 笔交易
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-card/80 rounded-xl p-1">
              <Tab active={tab === "record"} onClick={() => setTab("record")}>交易记录</Tab>
              <Tab active={tab === "stats"} onClick={() => setTab("stats")}>数据面板</Tab>
              <Tab active={tab === "weekly"} onClick={() => setTab("weekly")}>周度复盘</Tab>
            </div>
            <button
              onClick={onExport}
              className="ml-2 px-4 py-2 rounded-lg text-xs font-medium text-muted border border-border
                hover:text-text hover:border-accent/50 transition-all duration-200 cursor-pointer"
            >
              导出数据
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
