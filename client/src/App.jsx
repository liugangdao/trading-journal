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
import ExportBar from './components/ExportBar'
import Settings from './components/Settings'
import Policies from './components/Policies'
import PwaPrompt from './components/PwaPrompt'
import { api } from './hooks/useApi'
import { useTheme } from './hooks/useTheme'

export default function App() {
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
  const [pairs, setPairs] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(false)
  const { theme, toggleTheme } = useTheme()

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
  useEffect(() => {
    if (!authUser) return
    setLoading(true)
    Promise.all([api.getTrades(), api.getNotes(), api.getMonthlyNotes(), api.getPairs(), api.getPolicies()])
      .then(([t, n, mn, p, pol]) => { setTrades(t); setNotes(n); setMonthlyNotes(mn); setPairs(p); setPolicies(pol) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [authUser])

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
      if (editing) {
        const updated = await api.updateTrade(editing, form)
        setTrades(prev => prev.map(t => t.id === editing ? updated : t))
        setEditing(null)
      } else {
        const created = await api.createTrade(form)
        setTrades(prev => [...prev, created])
      }
      setShowForm(false)
    } catch (err) {
      console.error(err)
    }
  }, [editing])

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
      if (violations && violations.length > 0) {
        await api.updateTradeViolations(closingId, violations)
      }
      setClosingId(null)
      setShowForm(false)
    } catch (err) {
      console.error(err)
    }
  }, [closingId])

  const handleEditTrade = useCallback((trade) => {
    setEditing(trade.id)
    setClosingId(null)
    setShowForm(true)
    setTab("record")
  }, [])

  const handleDeleteTrade = useCallback(async (id) => {
    try {
      await api.deleteTrade(id)
      setTrades(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleCancelForm = useCallback(() => {
    setShowForm(false)
    setEditing(null)
    setClosingId(null)
  }, [])

  // Notes CRUD
  const handleAddNote = useCallback(async (form) => {
    try {
      const created = await api.createNote(form)
      setNotes(prev => [created, ...prev])
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleDeleteNote = useCallback(async (id) => {
    try {
      await api.deleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [])

  // Monthly Notes CRUD
  const handleAddMonthlyNote = useCallback(async (form) => {
    try {
      const created = await api.createMonthlyNote(form)
      setMonthlyNotes(prev => [created, ...prev])
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleDeleteMonthlyNote = useCallback(async (id) => {
    try {
      await api.deleteMonthlyNote(id)
      setMonthlyNotes(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [])

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

  return (
    <Layout tab={tab} setTab={setTab} tradeCount={closedTrades.length} openCount={openTrades.length} theme={theme} onToggleTheme={toggleTheme} user={authUser} onLogout={handleLogout}>
      {/* Record Tab */}
      {tab === "record" && (
        <div>
          {/* Export */}
          <ExportBar />

          {/* Open Positions */}
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
              initial={formInitial}
              editing={!!editing}
              mode={formMode}
              pairs={pairNames}
              policies={policies}
              onSubmit={closingId ? handleCloseSubmit : handleAddTrade}
              onCancel={handleCancelForm}
            />
          )}

          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} spreadCostMap={spreadCostMap} />
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && <Dashboard trades={closedTrades} spreadCostMap={spreadCostMap} theme={theme} />}

      {/* Weekly Tab */}
      {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} />}

      {/* Monthly Tab */}
      {tab === "monthly" && <MonthlyNotes notes={monthlyNotes} onAdd={handleAddMonthlyNote} onDelete={handleDeleteMonthlyNote} />}

      {/* Policy Tab */}
      {tab === "policy" && <Policies />}

      {/* Settings Tab */}
      {tab === "settings" && <Settings pairs={pairs} onPairsChange={setPairs} />}
      <PwaPrompt />
    </Layout>
  )
}
