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
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        加载中...
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
            onDeleteTrade={handleDeleteTrade}
          />
          <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />
          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} spreadCostMap={spreadCostMap} />
        </div>
      )
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
      mobileTabContent={mobileTabContent}
    >
      {/* Desktop tab content — unchanged */}
      {tab === "record" && (
        <div>
          <ExportBar onImported={reloadData} />
          <PsychologyPanel
            trades={trades}
            pairs={pairNames}
            spreadCostMap={spreadCostMap}
            onAddMissed={handleAddMissed}
            onDeleteTrade={handleDeleteTrade}
          />
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
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
