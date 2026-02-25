import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from './components/Layout'
import TradeForm, { emptyTrade } from './components/TradeForm'
import TradeTable from './components/TradeTable'
import Dashboard from './components/Dashboard'
import WeeklyNotes from './components/WeeklyNotes'
import MonthlyNotes from './components/MonthlyNotes'
import OpenPositions from './components/OpenPositions'
import { api } from './hooks/useApi'

export default function App() {
  const [trades, setTrades] = useState([])
  const [notes, setNotes] = useState([])
  const [monthlyNotes, setMonthlyNotes] = useState([])
  const [tab, setTab] = useState("record")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Derived data
  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades])
  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed'), [trades])

  // Load data on mount
  useEffect(() => {
    Promise.all([api.getTrades(), api.getNotes(), api.getMonthlyNotes()])
      .then(([t, n, mn]) => { setTrades(t); setNotes(n); setMonthlyNotes(mn) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      const updated = await api.updateTrade(closingId, { ...form, status: 'closed' })
      setTrades(prev => prev.map(t => t.id === closingId ? updated : t))
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
  const formMode = closingId ? "close" : editing ? "edit" : "open"
  const formInitial = closingId
    ? trades.find(t => t.id === closingId)
    : editing
      ? trades.find(t => t.id === editing)
      : emptyTrade()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        加载中...
      </div>
    )
  }

  return (
    <Layout tab={tab} setTab={setTab} tradeCount={closedTrades.length} openCount={openTrades.length} onExport={api.exportData}>
      {/* Record Tab */}
      {tab === "record" && (
        <div>
          {/* Open Positions */}
          <OpenPositions openTrades={openTrades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />

          {!showForm && (
            <button
              onClick={() => { setEditing(null); setClosingId(null); setShowForm(true) }}
              className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer
                hover:brightness-110 transition-all duration-200 mb-5">
              + 开仓
            </button>
          )}

          {showForm && (
            <TradeForm
              initial={formInitial}
              editing={!!editing}
              mode={formMode}
              onSubmit={closingId ? handleCloseSubmit : handleAddTrade}
              onCancel={handleCancelForm}
            />
          )}

          <TradeTable trades={closedTrades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} />
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && <Dashboard trades={closedTrades} />}

      {/* Weekly Tab */}
      {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} />}

      {/* Monthly Tab */}
      {tab === "monthly" && <MonthlyNotes notes={monthlyNotes} onAdd={handleAddMonthlyNote} onDelete={handleDeleteMonthlyNote} />}
    </Layout>
  )
}
