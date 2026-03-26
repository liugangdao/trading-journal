import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from './components/Layout'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import TradeForm, { emptyTrade } from './components/TradeForm'
import TradeTable from './components/TradeTable'
import Dashboard from './components/Dashboard'
import WeeklyNotes from './components/WeeklyNotes'
import MonthlyNotes from './components/MonthlyNotes'
import OpenPositions from './components/OpenPositions'
import PsychologyPanel from './components/PsychologyPanel'
import ExportBar from './components/ExportBar'
import Settings from './components/Settings'
import Policies from './components/Policies'
import NotesTab from './components/NotesTab'
import MoreTab from './components/MoreTab'
import PwaPrompt from './components/PwaPrompt'
import { api } from './hooks/useApi'
import { useTheme } from './hooks/useTheme'
import { ToastProvider, useToast } from './components/ui/Toast'
import { SkeletonKpi, SkeletonCard, SkeletonChart } from './components/ui/Skeleton'
import ConfirmDialog from './components/ui/ConfirmDialog'

function AppContent() {
  // Auth state: null = checking, false = logged out, object = logged in
  const [authUser, setAuthUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const [trades, setTrades] = useState([])
  const [notes, setNotes] = useState([])
  const [monthlyNotes, setMonthlyNotes] = useState([])
  const [tab, setTab] = useState("stats")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [editViolations, setEditViolations] = useState([])
  const [pairs, setPairs] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const [confirmState, setConfirmState] = useState({ open: false, id: null, type: null })

  // Check session on mount
  useEffect(() => {
    api.getMe()
      .then(user => {
        setAuthUser(user || false)
        setAuthChecked(true)
      })
      .catch(() => {
        setAuthUser(false)
        setAuthChecked(true)
      })
  }, [])

  // Set 401 handler to log user out
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      setAuthUser(false)
      setShowAuth(false)
    })
  }, [])

  // Load data when authenticated
  const reloadData = useCallback(() => {
    return Promise.all([api.getTrades(), api.getNotes(), api.getMonthlyNotes(), api.getPairs(), api.getPolicies()])
      .then(([t, n, mn, p, pol]) => { setTrades(t); setNotes(n); setMonthlyNotes(mn); setPairs(p); setPolicies(pol) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!authUser) return
    setLoading(true)
    reloadData().finally(() => setLoading(false))
  }, [authUser, reloadData])

  // Auth handlers
  const handleAuth = useCallback((user) => {
    setAuthUser(user)
    setShowAuth(false)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch (err) {
      console.error(err)
    }
    setAuthUser(false)
    setTrades([])
    setNotes([])
    setMonthlyNotes([])
    setPairs([])
    setPolicies([])
  }, [])

  // Derived data
  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades])
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed'), [trades])
  const spreadCostMap = useMemo(() => {
    const map = {}
    pairs.forEach(p => { map[p.name] = p.spread_cost })
    return map
  }, [pairs])
  const pairNames = useMemo(() => pairs.map(p => p.name), [pairs])

  // Trade CRUD
  const handleAddTrade = useCallback(async (form) => {
    try {
      const { violations, ...tradeData } = form
      if (editing) {
        const updated = await api.updateTrade(editing, tradeData)
        setTrades(prev => prev.map(t => t.id === editing ? updated : t))
        await api.updateTradeViolations(editing, violations || [])
        setEditing(null)
      } else {
        const created = await api.createTrade(tradeData)
        setTrades(prev => [...prev, created])
        if (violations && violations.length > 0) {
          await api.updateTradeViolations(created.id, violations)
        }
      }
      setShowForm(false)
      setEditViolations([])
      toast.success(editing ? '交易已更新' : '交易已记录')
    } catch (err) {
      console.error(err)
      toast.error('操作失败，请重试')
    }
  }, [editing, toast])

  const handleCloseTrade = useCallback((trade) => {
    setClosingId(trade.id)
    setEditing(null)
    setShowForm(true)
  }, [])

  const handleCloseSubmit = useCallback(async (form) => {
    try {
      const { violations, ...tradeData } = form
      const updated = await api.updateTrade(closingId, { ...tradeData, status: 'closed' })
      setTrades(prev => prev.map(t => t.id === closingId ? updated : t))
      await api.updateTradeViolations(closingId, violations || [])
      setClosingId(null)
      setShowForm(false)
      toast.success('已平仓')
    } catch (err) {
      console.error(err)
      toast.error('平仓失败，请重试')
    }
  }, [closingId, toast])

  const handleEditTrade = useCallback(async (trade) => {
    setEditing(trade.id)
    setClosingId(null)
    setTab("record")
    try {
      const violations = await api.getTradeViolations(trade.id)
      setEditViolations(violations.map(v => v.policy_id))
    } catch (err) {
      console.error(err)
      setEditViolations([])
    }
    setShowForm(true)
  }, [])

  const handleDeleteTrade = useCallback(async (id) => {
    try {
      await api.deleteTrade(id)
      setTrades(prev => prev.filter(t => t.id !== id))
      toast.success('已删除')
    } catch (err) {
      console.error(err)
      toast.error('删除失败，请重试')
    }
  }, [toast])

  const handleCancelForm = useCallback(() => {
    setShowForm(false)
    setEditing(null)
    setClosingId(null)
    setEditViolations([])
  }, [])

  const handleNewTrade = useCallback(() => {
    setEditing(null)
    setClosingId(null)
    setEditViolations([])
    setShowForm(true)
  }, [])

  const handleAddMissed = useCallback(async (form) => {
    try {
      const created = await api.createTrade(form)
      setTrades(prev => [...prev, created])
      toast.success('踏空记录已添加')
    } catch (err) {
      console.error(err)
      toast.error('记录失败，请重试')
    }
  }, [toast])

  // Notes CRUD
  const handleAddNote = useCallback(async (form) => {
    try {
      const created = await api.createNote(form)
      setNotes(prev => [created, ...prev])
      toast.success('笔记已保存')
    } catch (err) {
      console.error(err)
      toast.error('保存失败，请重试')
    }
  }, [toast])

  const handleDeleteNote = useCallback(async (id) => {
    try {
      await api.deleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('已删除')
    } catch (err) {
      console.error(err)
      toast.error('删除失败，请重试')
    }
  }, [toast])

  // Monthly Notes CRUD
  const handleAddMonthlyNote = useCallback(async (form) => {
    try {
      const created = await api.createMonthlyNote(form)
      setMonthlyNotes(prev => [created, ...prev])
      toast.success('笔记已保存')
    } catch (err) {
      console.error(err)
      toast.error('保存失败，请重试')
    }
  }, [toast])

  const handleDeleteMonthlyNote = useCallback(async (id) => {
    try {
      await api.deleteMonthlyNote(id)
      setMonthlyNotes(prev => prev.filter(n => n.id !== id))
      toast.success('已删除')
    } catch (err) {
      console.error(err)
      toast.error('删除失败，请重试')
    }
  }, [toast])

  // Delete confirmation
  const requestDelete = useCallback((id, type) => {
    setConfirmState({ open: true, id, type })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    const { id, type } = confirmState
    setConfirmState({ open: false, id: null, type: null })
    if (type === 'trade') await handleDeleteTrade(id)
    else if (type === 'note') await handleDeleteNote(id)
    else if (type === 'monthlyNote') await handleDeleteMonthlyNote(id)
  }, [confirmState, handleDeleteTrade, handleDeleteNote, handleDeleteMonthlyNote])

  const cancelDelete = useCallback(() => {
    setConfirmState({ open: false, id: null, type: null })
  }, [])

  const confirmDeleteTrade = useCallback((id) => requestDelete(id, 'trade'), [requestDelete])
  const confirmDeleteNote = useCallback((id) => requestDelete(id, 'note'), [requestDelete])
  const confirmDeleteMonthlyNote = useCallback((id) => requestDelete(id, 'monthlyNote'), [requestDelete])

  // Determine form mode and initial data
  const formMode = closingId ? "close" : editing ? "edit" : "new"
  const formInitial = closingId
    ? trades.find(t => t.id === closingId)
    : editing
      ? trades.find(t => t.id === editing)
      : emptyTrade(pairNames)

  // Loading auth check
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        加载中...
      </div>
    )
  }

  // Not logged in - show landing or auth
  if (!authUser) {
    if (showAuth) {
      return <AuthPage onAuth={handleAuth} onBack={() => setShowAuth(false)} theme={theme} onToggleTheme={toggleTheme} />
    }
    return <LandingPage onNavigateAuth={() => setShowAuth(true)} theme={theme} onToggleTheme={toggleTheme} />
  }

  // Logged in - loading data
  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text font-sans">
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="h-5 w-24 bg-border/60 rounded animate-pulse mb-1" />
            <div className="h-3 w-48 bg-border/40 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
          <div className="flex gap-3 flex-wrap mb-6">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      </div>
    )
  }

  // Mobile tab content renderer
  const mobileTabContent = (() => {
    switch (tab) {
      case 'record': return (
        <div>
          <PsychologyPanel
            trades={trades}
            pairs={pairNames}
            spreadCostMap={spreadCostMap}
            onAddMissed={handleAddMissed}
            onDeleteTrade={confirmDeleteTrade}
          />
          <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={confirmDeleteTrade} />
          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} />
        </div>
      )
      case 'stats': return <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />
      case 'notes': return (
        <NotesTab
          notes={notes} monthlyNotes={monthlyNotes}
          onAddNote={handleAddNote} onDeleteNote={confirmDeleteNote}
          onAddMonthlyNote={handleAddMonthlyNote} onDeleteMonthlyNote={confirmDeleteMonthlyNote}
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
      mobileTabContent={mobileTabContent}
    >
      {/* Desktop tab content */}
      <div key={tab} className="tab-enter">
        {tab === "record" && (
          <div>
            <ExportBar onImported={reloadData} />
            <PsychologyPanel
              trades={trades}
              pairs={pairNames}
              spreadCostMap={spreadCostMap}
              onAddMissed={handleAddMissed}
              onDeleteTrade={confirmDeleteTrade}
            />
            <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={confirmDeleteTrade} />
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
            <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={confirmDeleteTrade} spreadCostMap={spreadCostMap} />
          </div>
        )}
        {tab === "stats" && <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />}
        {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={confirmDeleteNote} />}
        {tab === "monthly" && <MonthlyNotes notes={monthlyNotes} onAdd={handleAddMonthlyNote} onDelete={confirmDeleteMonthlyNote} />}
        {tab === "policy" && <Policies />}
        {tab === "settings" && <Settings pairs={pairs} onPairsChange={setPairs} />}
      </div>
      <PwaPrompt />
      <ConfirmDialog
        open={confirmState.open}
        title="确认删除"
        message="删除后无法恢复，确定要继续吗？"
        onConfirm={handleConfirmDelete}
        onCancel={cancelDelete}
      />
    </Layout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
