import MobileSheet from './MobileSheet'
import TradeForm from './TradeForm'

// SVG icons for bottom tab bar
const icons = {
  record: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  stats: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  notes: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  more: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
}

const TABS = [
  { key: 'record', label: '记录', icon: icons.record },
  { key: 'stats', label: '统计', icon: icons.stats },
  { key: 'add', label: '', icon: null },
  { key: 'notes', label: '笔记', icon: icons.notes },
  { key: 'more', label: '更多', icon: icons.more },
]

export default function MobileLayout({
  tab, setTab, children,
  // Sheet props
  showForm, formMode, formInitial, onNewTrade, onFormSubmit, onFormCancel,
  pairs, policies, editViolations, editing, closingId,
}) {
  const sheetTitle = formMode === 'close' ? '平仓记录' : formMode === 'edit' ? '编辑交易' : '记录交易'

  const handleTabPress = (key) => {
    if (key === 'add') {
      onNewTrade()
      return
    }
    try { navigator.vibrate?.(10) } catch {}
    setTab(key)
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col">
      {/* Top bar */}
      <header className="bg-card border-b border-border px-4 py-3 text-center pt-safe">
        <h1 className="text-[15px] font-semibold">交易日志</h1>
      </header>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto px-3 py-3">
        <div key={tab} className="mobile-tab-enter">
          {children}
        </div>
      </main>

      {/* Bottom tab bar */}
      <nav className="bg-card border-t border-border flex items-end justify-around px-2 pt-1.5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        {TABS.map(t => (
          t.key === 'add' ? (
            <button
              key="add"
              onClick={() => handleTabPress('add')}
              className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-accent text-white shadow-lg shadow-accent/30
                active:scale-95 transition-transform duration-100"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          ) : (
            <button
              key={t.key}
              onClick={() => handleTabPress(t.key)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 min-w-[52px]
                active:scale-95 active:opacity-70 transition-all duration-100
                ${tab === t.key ? 'text-accent' : 'text-muted'}`}
            >
              {t.icon}
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          )
        ))}
      </nav>

      {/* Trade form sheet */}
      <MobileSheet open={showForm} onClose={onFormCancel} title={sheetTitle}>
        {showForm && (
          <div className="p-4">
            <TradeForm
              key={editing || closingId || 'new'}
              initial={formInitial}
              editing={!!editing}
              mode={formMode}
              pairs={pairs}
              policies={policies}
              initialViolations={editing ? editViolations : []}
              onSubmit={onFormSubmit}
              onCancel={onFormCancel}
              mobile
            />
          </div>
        )}
      </MobileSheet>
    </div>
  )
}
