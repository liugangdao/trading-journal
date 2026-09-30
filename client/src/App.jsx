import { useCallback, useEffect, useRef, useState } from 'react'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import TradeForm from './components/TradeForm'
import LegacyTradeForm from './components/LegacyTradeForm'
import JournalCard from './components/JournalCard'
import CalendarView from './components/CalendarView'
import ReviewOverlay from './components/ReviewOverlay'
import TradeImageEditor from './components/TradeImageEditor'
import Dashboard from './components/Dashboard'
import RStatsPanel from './components/RStatsPanel'
import WeeklyGoalSettings from './components/WeeklyGoalSettings'
import HyperliquidSettings from './components/HyperliquidSettings'
import Settings from './components/Settings'
import ExportBar from './components/ExportBar'
import PwaPrompt from './components/PwaPrompt'
import { api } from './hooks/useApi'
import { useTheme } from './hooks/useTheme'
import { ToastProvider, useToast } from './components/ui/Toast'
import Pagination from './components/ui/Pagination'
import { GlassButton, GlassSurface } from './components/ui/Glass'
import { JournalHeader, JournalMobileNavigation } from './components/JournalNavigation'
import { currentWeekKey, localMonth } from './lib/week'

const HISTORY_PAGE_SIZE = 20

function todayKey() {
  const date = new Date()
  return `${localMonth(date)}-${String(date.getDate()).padStart(2, '0')}`
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [tab, setTab] = useState('record')
  const [month, setMonth] = useState(() => localMonth())
  const [selectedDay, setSelectedDay] = useState(() => todayKey())
  const [trades, setTrades] = useState([])
  const [allTrades, setAllTrades] = useState([])
  const [historyTrades, setHistoryTrades] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const historyQueryRef = useRef('')
  const [pairs, setPairs] = useState([])
  const [weekGoal, setWeekGoal] = useState('')
  const [hyperliquidAccount, setHyperliquidAccount] = useState(null)
  const [hyperliquidError, setHyperliquidError] = useState('')
  const [showForm, setShowForm] = useState(true)
  const [editing, setEditing] = useState(null)
  const [legacyEditing, setLegacyEditing] = useState(null)
  const [legacyClosing, setLegacyClosing] = useState(false)
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  useEffect(() => {
    api.getMe().then(next => setUser(next || false)).catch(() => setUser(false)).finally(() => setAuthChecked(true))
    api.setUnauthorizedHandler(() => { setUser(false); setShowAuth(false) })
  }, [])

  const loadMonth = useCallback(async targetMonth => {
    const result = await api.getJournal(targetMonth)
    setTrades(result)
  }, [])
  const loadAll = useCallback(async () => {
    const result = await api.getTrades()
    setAllTrades(result.trades)
  }, [])
  const refreshHistory = () => setHistoryVersion(value => value + 1)

  const syncHyperliquidNow = useCallback(async () => {
    try {
      await api.syncHyperliquid()
      await loadMonth(month)
      refreshHistory()
      if (tab === 'stats') await loadAll()
      setHyperliquidAccount(await api.getHyperliquid())
      setHyperliquidError('')
    } catch (error) {
      setHyperliquidError(error.message)
      setHyperliquidAccount(await api.getHyperliquid().catch(() => null))
      throw error
    }
  }, [loadAll, loadMonth, month, tab])

  useEffect(() => {
    if (!user) return
    let active = true
    const check = async () => {
      const account = await api.getHyperliquid()
      if (!active) return
      setHyperliquidAccount(account)
      if (account) await syncHyperliquidNow()
    }
    check().catch(error => { if (active) setHyperliquidError(error.message) })
    const timer = setInterval(() => { if (active) check().catch(error => setHyperliquidError(error.message)) }, 30000)
    return () => { active = false; clearInterval(timer) }
  }, [user, syncHyperliquidNow])

  const onHyperliquidChanged = async () => {
    const account = await api.getHyperliquid()
    setHyperliquidAccount(account)
    setHyperliquidError('')
    if (account) await syncHyperliquidNow()
    else { await loadMonth(month); refreshHistory(); if (tab === 'stats') await loadAll() }
  }

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setLoadError('')
    Promise.all([api.getJournal(month), api.getPairs(), api.getWeeklyGoal(currentWeekKey())])
      .then(([journal, nextPairs, goal]) => { if (active) { setTrades(journal); setPairs(nextPairs); setWeekGoal(goal.content) } })
      .catch(error => { if (active) setLoadError(error.message || '读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, month])

  useEffect(() => {
    if (!user || tab !== 'history') return
    let active = true
    const queryKey = JSON.stringify([user.id, historyFrom, historyTo, historyOffset])
    const queryChanged = historyQueryRef.current !== queryKey
    historyQueryRef.current = queryKey
    // 同一查询后台刷新时保留卡片，避免打断展开详情和截图预览。
    setHistoryLoading(queryChanged)
    setHistoryError('')
    if (queryChanged) setHistoryTrades([])
    api.getTrades({ journal_only: '1', date_from: historyFrom, date_to: historyTo,
      limit: HISTORY_PAGE_SIZE, offset: historyOffset })
      .then(result => {
        if (!active) return
        if (historyOffset >= result.total && historyOffset > 0) {
          setHistoryOffset(Math.max(0, Math.floor((result.total - 1) / HISTORY_PAGE_SIZE) * HISTORY_PAGE_SIZE))
          return
        }
        setHistoryTrades(result.trades)
        setHistoryTotal(result.total)
      })
      .catch(error => { if (active) setHistoryError(error.message || '交易记录读取失败') })
      .finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [user, tab, historyFrom, historyTo, historyOffset, historyVersion])

  useEffect(() => {
    if (!user || tab !== 'stats') return
    loadAll().catch(error => setLoadError(error.message || '统计读取失败'))
  }, [user, tab, loadAll])

  const beginNew = () => { setEditing(null); setShowForm(true); setTab('record') }
  const changeTab = nextTab => { setTab(nextTab); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const beginEdit = trade => {
    if (!trade.entry_reason && trade.source !== 'hyperliquid') { setLegacyEditing(trade); setLegacyClosing(false); setTab('history') }
    else { setEditing(trade); setShowForm(true); setTab('record') }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelForm = () => { setEditing(null); setShowForm(false) }
  const saveLegacyTrade = async form => {
    try {
      const { violations, ...trade } = form
      await api.updateTrade(legacyEditing.id, { ...trade, status: legacyClosing ? 'closed' : trade.status })
      setLegacyEditing(null); setLegacyClosing(false)
      await loadMonth(month)
      refreshHistory()
      toast.success('交易已更新')
    } catch (error) { toast.error(error.message || '保存失败') }
  }
  const saveTrade = async (form, images, targetTrade = editing) => {
    const saved = targetTrade ? await api.updateJournal(targetTrade.id, form) : await api.createJournal(form)
    let uploadError = null
    for (const image of images) {
      try { await api.uploadJournalImage(saved.id, image) }
      catch (error) { uploadError = error; break }
    }
    setEditing(null)
    setShowForm(false)
    const tradeMonth = saved.open_time.slice(0, 7)
    setSelectedDay(saved.open_time.slice(0, 10))
    if (tradeMonth !== month) setMonth(tradeMonth)
    else await loadMonth(month).catch(error => toast.error(`交易已保存，但列表刷新失败：${error.message}`))
    refreshHistory()
    toast.success('交易已保存')
    if (uploadError) toast.error(`部分截图未保存：${uploadError.message}。可重新编辑交易补传。`)
    return saved
  }
  const deleteTrade = async id => {
    if (!window.confirm('确定删除这笔交易及其截图吗？')) return
    try { await api.deleteJournal(id); await loadMonth(month); refreshHistory(); toast.success('交易已删除') }
    catch (error) { toast.error(error.message || '删除失败') }
  }
  const logout = async () => {
    try { await api.logout() } catch (error) { console.error(error) }
    setUser(false); setTrades([]); setAllTrades([]); setHistoryTrades([]); setHistoryTotal(0); setHistoryOffset(0); setHistoryFrom(''); setHistoryTo(''); setReview(null); setPairs([]); setWeekGoal(''); setHyperliquidAccount(null); setHyperliquidError('')
  }
  const changeMonth = value => { setMonth(value); setSelectedDay(`${value}-01`) }
  const dollarTrades = allTrades.filter(trade => trade.status === 'closed' && trade.gross_pnl != null)
  const spreadCostMap = Object.fromEntries(pairs.map(pair => [pair.name, pair.spread_cost]))
  const changeHistoryDate = (kind, value) => {
    if (kind === 'from') { setHistoryFrom(value); if (historyTo && value > historyTo) setHistoryTo('') }
    else { setHistoryTo(value); if (historyFrom && value < historyFrom) setHistoryFrom('') }
    setHistoryOffset(0)
    setReview(null)
  }
  const navigateReview = async nextIndex => {
    if (nextIndex < 0 || nextIndex >= historyTotal) return
    try {
      const result = await api.getTrades({ journal_only: '1', date_from: historyFrom,
        date_to: historyTo, limit: 1, offset: nextIndex })
      if (result.trades[0]) setReview({ trade: result.trades[0], index: nextIndex })
    } catch (error) { toast.error(error.message || '切换交易失败') }
  }

  if (!authChecked) return <div className="min-h-screen bg-bg text-muted flex items-center justify-center">加载中…</div>
  if (!user) return showAuth
    ? <AuthPage onAuth={next => { setUser(next); setShowAuth(false) }} onBack={() => setShowAuth(false)} theme={theme} onToggleTheme={toggleTheme} />
    : <LandingPage onNavigateAuth={() => setShowAuth(true)} theme={theme} onToggleTheme={toggleTheme} />

  return <div className="journal-app text-text">
    <JournalHeader active={tab} onChange={changeTab} theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />
    <main className="journal-main">
      {loadError && <div className="mb-4 p-3 rounded-lg bg-red/10 text-red text-sm" role="alert">{loadError}</div>}
      {loading && <p className="text-sm text-muted mb-4">正在读取交易…</p>}
      {tab === 'record' && <div className="space-y-5">
        {showForm ? <TradeForm key={editing?.id || 'new'} initial={editing} pairs={pairs.map(pair => pair.name)} weekGoal={weekGoal} onSave={saveTrade} onCancel={cancelForm} />
          : <GlassButton variant="primary" onClick={beginNew} className="w-full sm:w-auto">+ 记录交易</GlassButton>}
        <section><div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold">最近记录</h2><button onClick={() => setTab('history')} className="text-xs text-accent cursor-pointer">查看交易记录 →</button></div><div className="space-y-3">{trades.slice(0, 5).map(trade => <JournalCard key={trade.id} trade={trade} onEdit={beginEdit} onDelete={deleteTrade} />)}{!trades.length && !loading && <GlassSurface as="p" className="p-5 text-sm text-muted">本月还没有记录。先写下一笔交易的入场判断。</GlassSurface>}</div></section>
      </div>}
      {tab === 'history' && <div className="space-y-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">交易记录</h2><p className="text-xs text-muted mt-1">按时间查找交易，对着截图逐笔复盘。</p></div><GlassButton variant="primary" disabled={historyLoading || !historyTrades.length} onClick={() => setReview({ trade: historyTrades[0], index: historyOffset })}>逐笔复盘</GlassButton></div>
        <GlassSurface className="p-4 sm:p-5 flex flex-wrap items-end gap-3 text-sm">
          <label className="text-xs text-muted">开始日期<input type="date" value={historyFrom} max={historyTo || undefined} onChange={event => changeHistoryDate('from', event.target.value)} className="block mt-1 bg-input text-text border border-border rounded-lg px-3 py-2" /></label>
          <label className="text-xs text-muted">结束日期<input type="date" value={historyTo} min={historyFrom || undefined} onChange={event => changeHistoryDate('to', event.target.value)} className="block mt-1 bg-input text-text border border-border rounded-lg px-3 py-2" /></label>
          {(historyFrom || historyTo) && <button onClick={() => { setHistoryFrom(''); setHistoryTo(''); setHistoryOffset(0); setReview(null) }} className="text-xs text-accent px-2 py-2 cursor-pointer">清除筛选</button>}
          <span className="text-xs text-muted ml-auto">{historyLoading ? '正在筛选…' : `共 ${historyTotal} 笔`}</span>
        </GlassSurface>
        {legacyEditing && <div><LegacyTradeForm key={legacyEditing.id} initial={legacyEditing} editing={!legacyClosing} mode={legacyClosing ? 'close' : 'edit'} pairs={pairs.map(pair => pair.name)} policies={[]} initialViolations={[]} onSubmit={saveLegacyTrade} onCancel={() => { setLegacyEditing(null); setLegacyClosing(false) }} /><TradeImageEditor tradeId={legacyEditing.id} onChanged={() => loadMonth(month)} /></div>}
        {historyError && <p role="alert" className="text-sm text-red">{historyError}</p>}
        {historyLoading && <p className="text-sm text-muted">正在读取交易记录…</p>}
        {!historyLoading && !historyError && <section><div className="space-y-3">{historyTrades.map(trade => <JournalCard key={trade.id} trade={trade} onEdit={beginEdit} onDelete={deleteTrade} />)}{!historyTrades.length && <GlassSurface as="p" className="p-5 text-sm text-muted">这个时间范围内没有交易记录。</GlassSurface>}</div></section>}
        {!historyLoading && !historyError && <Pagination total={historyTotal} limit={HISTORY_PAGE_SIZE} offset={historyOffset} onChange={setHistoryOffset} />}
      </div>}
      {tab === 'calendar' && <CalendarView month={month} trades={trades} selectedDay={selectedDay} onSelectDay={setSelectedDay} onMonthChange={changeMonth} onEdit={beginEdit} onDelete={deleteTrade} />}
      {tab === 'stats' && <div className="space-y-6"><RStatsPanel trades={allTrades} theme={theme} /><div><h2 className="text-base font-semibold mb-3">美元统计</h2><Dashboard trades={dollarTrades} spreadCostMap={spreadCostMap} theme={theme} /></div></div>}
      {tab === 'settings' && <div className="space-y-5"><div><h2 className="text-xl font-bold">设置</h2><p className="text-xs text-muted mt-1">整理品种、周目标和数据。</p></div><WeeklyGoalSettings onCurrentGoalChange={setWeekGoal} /><HyperliquidSettings account={hyperliquidAccount} error={hyperliquidError} onChanged={onHyperliquidChanged} onSync={syncHyperliquidNow} /><GlassSurface className="p-4 sm:p-6"><Settings pairs={pairs} onPairsChange={setPairs} /></GlassSurface><GlassSurface as="details" className="p-4 sm:p-6"><summary className="text-sm font-semibold cursor-pointer">数据导入与导出</summary><div className="mt-4"><ExportBar onImported={async () => { await loadMonth(month); refreshHistory() }} /></div></GlassSurface></div>}
    </main>
    <JournalMobileNavigation active={tab} onChange={changeTab} />
    {review && <ReviewOverlay trade={review.trade} position={review.index} total={historyTotal} pairs={pairs.map(pair => pair.name)} weekGoal={weekGoal} onClose={() => setReview(null)} onNavigate={navigateReview} onSave={async (form, images) => { const saved = await saveTrade(form, images, review.trade); setReview(current => current && { ...current, trade: saved }) }} />}
    <PwaPrompt />
  </div>
}

export default function App() {
  return <ToastProvider><AppContent /></ToastProvider>
}
