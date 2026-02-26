import Tab from './ui/Tab'

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg text-muted hover:text-text hover:bg-hover transition-all duration-200 cursor-pointer"
      title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

export default function Layout({ tab, setTab, tradeCount, openCount, theme, onToggleTheme, children }) {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-header-bg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">交易日志</h1>
            <p className="text-xs text-muted mt-0.5">
              外汇 &middot; 贵金属 &middot; 能源 &nbsp;|&nbsp; 已平仓 {tradeCount} 笔{openCount > 0 && <> &middot; 持仓中 {openCount} 笔</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-card/80 rounded-xl p-1">
              <Tab active={tab === "stats"} onClick={() => setTab("stats")}>数据面板</Tab>
              <Tab active={tab === "record"} onClick={() => setTab("record")}>交易记录</Tab>
              <Tab active={tab === "weekly"} onClick={() => setTab("weekly")}>周度复盘</Tab>
              <Tab active={tab === "monthly"} onClick={() => setTab("monthly")}>月度复盘</Tab>
              <Tab active={tab === "settings"} onClick={() => setTab("settings")}>设置</Tab>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
