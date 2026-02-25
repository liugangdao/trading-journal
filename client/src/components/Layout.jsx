import Tab from './ui/Tab'

export default function Layout({ tab, setTab, tradeCount, onExport, children }) {
  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {/* Fixed Header with frosted glass */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-[#0f172a]/90 to-[#1e1b4b]/90 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Trading Journal</h1>
            <p className="text-xs text-muted mt-0.5">
              Forex &middot; Metals &middot; Energy &nbsp;|&nbsp; {tradeCount} trades recorded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-card/80 rounded-xl p-1">
              <Tab active={tab === "record"} onClick={() => setTab("record")}>Records</Tab>
              <Tab active={tab === "stats"} onClick={() => setTab("stats")}>Dashboard</Tab>
              <Tab active={tab === "weekly"} onClick={() => setTab("weekly")}>Review</Tab>
            </div>
            <button
              onClick={onExport}
              className="ml-2 px-4 py-2 rounded-lg text-xs font-medium text-muted border border-border
                hover:text-text hover:border-accent/50 transition-all duration-200 cursor-pointer"
            >
              Export JSON
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
