import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import TradeForm, { emptyTrade } from './components/TradeForm'
import TradeTable from './components/TradeTable'
import Dashboard from './components/Dashboard'
import WeeklyNotes from './components/WeeklyNotes'
import { api } from './hooks/useApi'

export default function App() {
  const [trades, setTrades] = useState([])
  const [notes, setNotes] = useState([])
  const [tab, setTab] = useState("record")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load data on mount
  useEffect(() => {
    Promise.all([api.getTrades(), api.getNotes()])
      .then(([t, n]) => { setTrades(t); setNotes(n) })
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

  const handleEditTrade = useCallback((trade) => {
    setEditing(trade.id)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-muted">
        加载中...
      </div>
    )
  }

  return (
    <Layout tab={tab} setTab={setTab} tradeCount={trades.length} onExport={api.exportData}>
      {/* Record Tab */}
      {tab === "record" && (
        <div>
          {!showForm && (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="bg-accent text-white px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer
                hover:brightness-110 transition-all duration-200 mb-5">
              + 新建交易
            </button>
          )}

          {showForm && (
            <TradeForm
              initial={editing ? trades.find(t => t.id === editing) : emptyTrade()}
              editing={!!editing}
              onSubmit={handleAddTrade}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          )}

          <TradeTable trades={trades} onEdit={handleEditTrade} onDelete={handleDeleteTrade} />
        </div>
      )}

      {/* Stats Tab */}
      {tab === "stats" && <Dashboard trades={trades} />}

      {/* Weekly Tab */}
      {tab === "weekly" && <WeeklyNotes notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} />}
    </Layout>
  )
}
