# PWA Mobile Native App Feel — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native iOS app feel to the mobile PWA (`<640px`) with bottom tab bar, full-screen form sheet, combined notes/more tabs, touch feedback, and safe area support. Desktop unchanged.

**Architecture:** CSS-driven responsive split — mobile components render via `block sm:hidden`, desktop via `hidden sm:block`. No new state; existing App.jsx state drives the mobile sheet. New components: MobileLayout, MobileSheet, NotesTab, MoreTab.

**Tech Stack:** React 19, Tailwind CSS v4, CSS animations (no animation library)

**Spec:** `docs/superpowers/specs/2026-03-19-pwa-mobile-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `client/index.html` | Modify | Add `viewport-fit=cover` |
| `client/src/index.css` | Modify | Add sheet animation keyframes, safe area utilities |
| `client/src/components/MobileLayout.jsx` | Create | Mobile top bar + bottom tab bar + sheet container |
| `client/src/components/MobileSheet.jsx` | Create | Full-screen slide-up sheet with animation, scroll lock, backdrop |
| `client/src/components/NotesTab.jsx` | Create | Combined weekly/monthly notes with segment toggle |
| `client/src/components/MoreTab.jsx` | Create | Combined policy/settings/export/user info |
| `client/src/components/Layout.jsx` | Modify | Render MobileLayout on mobile, current layout on desktop |
| `client/src/components/App.jsx` → `client/src/App.jsx` | Modify | Pass sheet props to Layout, add `onNewTrade` handler |
| `client/src/components/PwaPrompt.jsx` | Modify | Reposition above bottom tab bar on mobile |

---

## Chunk 1: Foundation

### Task 1: Viewport & CSS Animations

**Files:**
- Modify: `client/index.html:5`
- Modify: `client/src/index.css`

- [ ] **Step 1: Update viewport meta tag**

In `client/index.html`, change line 5 from:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
to:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 2: Add CSS animations and utilities to index.css**

Append to `client/src/index.css` (after the `@theme` block):

```css
/* Mobile sheet animations */
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes sheet-down {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}
@keyframes fade-in-overlay {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fade-out-overlay {
  from { opacity: 1; }
  to { opacity: 0; }
}

.animate-sheet-up {
  animation: sheet-up 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
}
.animate-sheet-down {
  animation: sheet-down 250ms cubic-bezier(0.32, 0.72, 0, 1) both;
}
.animate-fade-in-overlay {
  animation: fade-in-overlay 200ms ease both;
}
.animate-fade-out-overlay {
  animation: fade-out-overlay 200ms ease both;
}

/* Mobile tab content transition */
.mobile-tab-enter {
  animation: fade-in 150ms ease both;
}

/* Safe area padding utilities */
.pt-safe {
  padding-top: env(safe-area-inset-top);
}
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 3: Verify dev server loads without errors**

Run: `npm run dev` (already running)
Open browser at `http://localhost:3000` — page should load unchanged.

- [ ] **Step 4: Commit**

```bash
git add client/index.html client/src/index.css
git commit -m "feat: add viewport-fit=cover and mobile animation CSS"
```

---

### Task 2: MobileSheet Component

**Files:**
- Create: `client/src/components/MobileSheet.jsx`

- [ ] **Step 1: Create MobileSheet.jsx**

```jsx
import { useState, useEffect } from 'react'

export default function MobileSheet({ open, onClose, title, children }) {
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setClosing(false)
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setVisible(false)
      document.body.style.overflow = ''
      onClose()
    }, 250)
  }

  if (!open && !visible) return null

  return (
    <div className="fixed inset-0 z-[90] sm:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${closing ? 'animate-fade-out-overlay' : 'animate-fade-in-overlay'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className={`absolute inset-0 bg-bg flex flex-col ${closing ? 'animate-sheet-down' : 'animate-sheet-up'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card pt-safe">
          <button
            onClick={handleClose}
            className="text-accent text-sm font-medium min-w-[60px] text-left active:opacity-70"
          >
            取消
          </button>
          <span className="text-text text-[15px] font-semibold">{title}</span>
          <div className="min-w-[60px]" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/MobileSheet.jsx
git commit -m "feat: add MobileSheet slide-up component"
```

---

### Task 3: MobileLayout Component

**Files:**
- Create: `client/src/components/MobileLayout.jsx`

This is the core mobile layout with top bar and bottom tab bar.

- [ ] **Step 1: Create MobileLayout.jsx**

```jsx
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
  { key: 'add', label: '', icon: null }, // center action button
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
    // Haptic feedback (silent fail on unsupported)
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
      <nav className="bg-card border-t border-border flex items-end justify-around px-2 pt-1.5 pb-safe"
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/MobileLayout.jsx
git commit -m "feat: add MobileLayout with bottom tab bar and sheet"
```

---

### Task 4: NotesTab Component

**Files:**
- Create: `client/src/components/NotesTab.jsx`

- [ ] **Step 1: Create NotesTab.jsx**

```jsx
import { useState } from 'react'
import WeeklyNotes from './WeeklyNotes'
import MonthlyNotes from './MonthlyNotes'

export default function NotesTab({ notes, monthlyNotes, onAddNote, onDeleteNote, onAddMonthlyNote, onDeleteMonthlyNote }) {
  const [view, setView] = useState('weekly')

  return (
    <div>
      {/* Segment toggle */}
      <div className="flex bg-card rounded-lg p-1 mb-4 border border-border">
        <button
          onClick={() => setView('weekly')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-150
            active:scale-[0.97] active:opacity-80
            ${view === 'weekly' ? 'bg-accent text-white shadow-sm' : 'text-muted'}`}
        >
          周度复盘
        </button>
        <button
          onClick={() => setView('monthly')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-150
            active:scale-[0.97] active:opacity-80
            ${view === 'monthly' ? 'bg-accent text-white shadow-sm' : 'text-muted'}`}
        >
          月度复盘
        </button>
      </div>

      {/* Content */}
      <div key={view} className="mobile-tab-enter">
        {view === 'weekly'
          ? <WeeklyNotes notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} />
          : <MonthlyNotes notes={monthlyNotes} onAdd={onAddMonthlyNote} onDelete={onDeleteMonthlyNote} />
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/NotesTab.jsx
git commit -m "feat: add NotesTab with weekly/monthly toggle"
```

---

### Task 5: MoreTab Component

**Files:**
- Create: `client/src/components/MoreTab.jsx`

- [ ] **Step 1: Create MoreTab.jsx**

```jsx
import Policies from './Policies'
import Settings from './Settings'
import ExportBar from './ExportBar'

export default function MoreTab({ pairs, onPairsChange, onImported, theme, onToggleTheme, user, onLogout }) {
  return (
    <div className="space-y-6">
      {/* User info + theme */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">{user?.username}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-red px-3 py-1.5 rounded-lg border border-border
              active:scale-[0.97] active:opacity-80 transition-all duration-100"
          >
            退出登录
          </button>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm">深色模式</span>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={onToggleTheme}
            className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-accent' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-[18px]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Export/Import */}
      <div>
        <h3 className="text-sm font-bold mb-3">数据管理</h3>
        <ExportBar onImported={onImported} />
      </div>

      {/* Policies */}
      <div>
        <Policies />
      </div>

      {/* Pair settings */}
      <div>
        <Settings pairs={pairs} onPairsChange={onPairsChange} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/MoreTab.jsx
git commit -m "feat: add MoreTab combining settings/policy/export"
```

---

## Chunk 2: Integration

### Task 6: Update Layout.jsx — Responsive Split

**Files:**
- Modify: `client/src/components/Layout.jsx`

The desktop layout stays exactly the same. We add a mobile path that renders `MobileLayout`.

- [ ] **Step 1: Rewrite Layout.jsx**

Replace the entire file with:

```jsx
import Tab from './ui/Tab'
import MobileLayout from './MobileLayout'
import NotesTab from './NotesTab'
import MoreTab from './MoreTab'

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

export default function Layout({
  tab, setTab, tradeCount, openCount, theme, onToggleTheme, user, onLogout, children,
  // Mobile-specific props
  showForm, formMode, formInitial, onNewTrade, onFormSubmit, onFormCancel,
  pairs, policies, editViolations, editing, closingId, onPairsChange, onImported,
  // Notes props for mobile combined tab
  notes, monthlyNotes, onAddNote, onDeleteNote, onAddMonthlyNote, onDeleteMonthlyNote,
  // Content renderers for mobile
  mobileTabContent,
}) {
  return (
    <>
      {/* Mobile layout — hidden on sm+ */}
      <div className="block sm:hidden">
        <MobileLayout
          tab={tab} setTab={setTab}
          showForm={showForm} formMode={formMode} formInitial={formInitial}
          onNewTrade={onNewTrade} onFormSubmit={onFormSubmit} onFormCancel={onFormCancel}
          pairs={pairs} policies={policies} editViolations={editViolations}
          editing={editing} closingId={closingId}
        >
          {mobileTabContent}
        </MobileLayout>
      </div>

      {/* Desktop layout — hidden on mobile */}
      <div className="hidden sm:block">
        <div className="min-h-screen bg-bg text-text font-sans">
          {/* Fixed Header */}
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-header-bg border-b border-border">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">交易日志</h1>
                <p className="text-[10px] sm:text-xs text-muted mt-0.5">
                  外汇 &middot; 贵金属 &middot; 能源 &nbsp;|&nbsp; 已平仓 {tradeCount} 笔{openCount > 0 && <> &middot; 持仓中 {openCount} 笔</>}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex gap-1 bg-card/80 rounded-xl p-1 overflow-x-auto">
                  <Tab active={tab === "stats"} onClick={() => setTab("stats")}>数据面板</Tab>
                  <Tab active={tab === "record"} onClick={() => setTab("record")}>交易记录</Tab>
                  <Tab active={tab === "weekly"} onClick={() => setTab("weekly")}>周度复盘</Tab>
                  <Tab active={tab === "monthly"} onClick={() => setTab("monthly")}>月度复盘</Tab>
                  <Tab active={tab === "policy"} onClick={() => setTab("policy")}>交易政策</Tab>
                  <Tab active={tab === "settings"} onClick={() => setTab("settings")}>设置</Tab>
                </div>
                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                {user && (
                  <div className="flex items-center gap-2 ml-1">
                    <span className="text-xs text-muted hidden sm:inline">{user.username}</span>
                    <button
                      onClick={onLogout}
                      className="text-xs text-muted hover:text-red transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-hover"
                    >
                      退出
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: Layout renders MobileLayout on mobile, desktop unchanged"
```

---

### Task 7: Update App.jsx — Wire Mobile Props

**Files:**
- Modify: `client/src/App.jsx`

This is the main integration task. We need to:
1. Add an `onNewTrade` handler
2. Compute mobile tab content (record tab without form/ExportBar, notes tab combined, more tab combined)
3. Pass all mobile-specific props through Layout

- [ ] **Step 1: Update App.jsx**

After the existing `handleCancelForm` (line 171), add the `onNewTrade` handler:

```jsx
  const handleNewTrade = useCallback(() => {
    setEditing(null)
    setClosingId(null)
    setEditViolations([])
    setShowForm(true)
  }, [])
```

Replace the return JSX (the `<Layout>` block, lines 245-299) with:

```jsx
  // Mobile record tab content: no form, no ExportBar
  const mobileRecordContent = (
    <div>
      <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />
      <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} spreadCostMap={spreadCostMap} />
    </div>
  )

  // Mobile tab content renderer
  const mobileTabContent = (() => {
    switch (tab) {
      case 'record': return mobileRecordContent
      case 'stats': return <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />
      case 'notes': return (
        <NotesTab
          notes={notes} monthlyNotes={monthlyNotes}
          onAddNote={handleAddNote} onDeleteNote={handleDeleteNote}
          onAddMonthlyNote={handleAddMonthlyNote} onDeleteMonthlyNote={handleDeleteMonthlyNote}
        />
      )
      case 'more': return (
        <MoreTab
          pairs={pairs} onPairsChange={setPairs} onImported={reloadData}
          theme={theme} onToggleTheme={toggleTheme} user={authUser} onLogout={handleLogout}
        />
      )
      default: return null
    }
  })()

  return (
    <Layout
      tab={tab} setTab={setTab} tradeCount={closedTrades.length} openCount={openTrades.length}
      theme={theme} onToggleTheme={toggleTheme} user={authUser} onLogout={handleLogout}
      // Mobile sheet props
      showForm={showForm} formMode={formMode} formInitial={formInitial}
      onNewTrade={handleNewTrade} onFormSubmit={closingId ? handleCloseSubmit : handleAddTrade}
      onFormCancel={handleCancelForm}
      pairs={pairNames} policies={policies} editViolations={editViolations}
      editing={editing} closingId={closingId}
      onPairsChange={setPairs} onImported={reloadData}
      // Notes props
      notes={notes} monthlyNotes={monthlyNotes}
      onAddNote={handleAddNote} onDeleteNote={handleDeleteNote}
      onAddMonthlyNote={handleAddMonthlyNote} onDeleteMonthlyNote={handleDeleteMonthlyNote}
      // Mobile tab content
      mobileTabContent={mobileTabContent}
    >
      {/* Desktop tab content — unchanged */}
      {tab === "record" && (
        <div>
          <ExportBar onImported={reloadData} />
          <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />
          {!showForm && (
            <button
              onClick={() => { setEditing(null); setClosingId(null); setShowForm(true) }}
              className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer
                hover:brightness-110 transition-all duration-200 mb-5">
              + 记录交易
            </button>
          )}
          {showForm && (
            <TradeForm
              key={editing || closingId || 'new'}
              initial={formInitial}
              editing={!!editing}
              mode={formMode}
              pairs={pairNames}
              policies={policies}
              initialViolations={editing ? editViolations : []}
              onSubmit={closingId ? handleCloseSubmit : handleAddTrade}
              onCancel={handleCancelForm}
            />
          )}
          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} spreadCostMap={spreadCostMap} />
        </div>
      )}
      {tab === "stats" && <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />}
      {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} />}
      {tab === "monthly" && <MonthlyNotes notes={monthlyNotes} onAdd={handleAddMonthlyNote} onDelete={handleDeleteMonthlyNote} />}
      {tab === "policy" && <Policies />}
      {tab === "settings" && <Settings pairs={pairs} onPairsChange={setPairs} />}
      <PwaPrompt />
    </Layout>
  )
```

Also add the import for `NotesTab` and `MoreTab` at the top of the file:

```jsx
import NotesTab from './components/NotesTab'
import MoreTab from './components/MoreTab'
```

- [ ] **Step 2: Verify desktop is unchanged**

Open browser at `http://localhost:3000` in a wide window (>640px). All tabs should work identically to before.

- [ ] **Step 3: Verify mobile layout**

Open browser DevTools, toggle device mode to iPhone 14/15 (390px wide). Should see:
- Top bar with "交易日志"
- Content area with trade records
- Bottom tab bar with 4 tabs + center "+" button
- Tapping "+" opens sheet with trade form
- Tapping tabs switches content

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire mobile layout with sheet props and tab content"
```

---

### Task 8: Update PwaPrompt Position

**Files:**
- Modify: `client/src/components/PwaPrompt.jsx`

- [ ] **Step 1: Add bottom offset for mobile tab bar**

Change the container div className from:
```
fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80
```
to:
```
fixed bottom-20 left-4 right-4 sm:bottom-4 sm:left-auto sm:right-4 sm:w-80
```

This positions the prompt above the bottom tab bar on mobile (tab bar is ~60px tall).

- [ ] **Step 2: Commit**

```bash
git add client/src/components/PwaPrompt.jsx
git commit -m "fix: position PwaPrompt above mobile tab bar"
```

---

### Task 9: Add Touch Feedback to Existing Mobile Components

**Files:**
- Modify: `client/src/components/TradeTable.jsx` (TradeCard component)
- Modify: `client/src/components/OpenPositions.jsx`

- [ ] **Step 1: Add touch feedback to TradeCard**

In `TradeTable.jsx`, line 29, update the card container div:

From:
```jsx
<div className="bg-card border border-border rounded-xl p-3">
```
To:
```jsx
<div className="bg-card border border-border rounded-xl p-3 active:scale-[0.97] active:opacity-80 transition-transform duration-100">
```

- [ ] **Step 2: Add touch feedback to OpenPositions cards**

In `OpenPositions.jsx`, line 9, update the card div:

From:
```jsx
<div key={trade.id} className="bg-card border border-border rounded-xl p-4">
```
To:
```jsx
<div key={trade.id} className="bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform duration-100">
```

Also add touch feedback to the 平仓 and 删除 buttons (lines 40, 46):

Update 平仓 button to include `active:scale-95`:
```jsx
className="flex-1 bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
  hover:brightness-110 active:scale-95 transition-all duration-200"
```

Update 删除 button to include `active:scale-95`:
```jsx
className="text-muted border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer
  hover:text-red hover:border-red/30 active:scale-95 transition-all duration-200"
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/TradeTable.jsx client/src/components/OpenPositions.jsx
git commit -m "feat: add touch feedback to mobile trade cards"
```

---

### Task 10: Final Verification & Polish

- [ ] **Step 1: Test complete mobile flow**

In browser DevTools mobile mode (iPhone 14, 390px):
1. Bottom tab bar shows 4 tabs + center "+"
2. Tap 记录 → shows open positions + closed trades
3. Tap 统计 → shows dashboard
4. Tap 笔记 → shows segment toggle (周度/月度) + notes
5. Tap 更多 → shows user info, theme toggle, export, policies, settings
6. Tap "+" → sheet slides up with trade form
7. Tap 取消 → sheet slides down
8. Tap 平仓 on open position → sheet opens in close mode
9. Tap a closed trade → expands, tap 编辑 → sheet opens in edit mode

- [ ] **Step 2: Test desktop is unchanged**

Resize browser to >640px:
1. Header with horizontal tabs appears
2. All 6 tabs work as before
3. Record tab has ExportBar, inline form, trade table
4. No bottom tab bar visible
5. No sheet — form renders inline

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: PWA mobile native app feel - complete implementation"
```
