import { useState } from 'react'
import Input from './ui/Input'
import Select from './ui/Select'
import { PAIRS, DIRECTIONS, STRATEGIES, TIMEFRAMES, SCORES, EMOTIONS } from '../lib/constants'
import { calcTrade } from '../lib/calc'

const today = () => new Date().toISOString().split("T")[0]

export function emptyTrade() {
  return {
    date: today(), pair: "EUR/USD", direction: "多(Buy)",
    strategy: "趋势跟踪", timeframe: "H4", lots: "", entry: "", stop: "", target: "",
    exit_price: "", gross_pnl: "", swap: "0", score: "B-基本执行", emotion: "冷静理性", notes: ""
  }
}

export default function TradeForm({ initial, editing, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial || emptyTrade())
  const uf = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.entry || !form.stop || !form.exit_price || !form.gross_pnl) return
    onSubmit(form)
  }

  const preview = (form.entry && form.stop && form.exit_price && form.gross_pnl) ? calcTrade(form) : null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 mb-6 animate-in slide-in-from-top-2">
      <h3 className="text-base font-bold mb-5">
        {editing ? "Edit Trade" : "New Trade"}
      </h3>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        <Field label="Date"><Input type="date" value={form.date} onChange={uf("date")} /></Field>
        <Field label="Pair"><Select value={form.pair} onChange={uf("pair")} options={PAIRS} /></Field>
        <Field label="Direction"><Select value={form.direction} onChange={uf("direction")} options={DIRECTIONS} /></Field>
        <Field label="Strategy"><Select value={form.strategy} onChange={uf("strategy")} options={STRATEGIES} /></Field>
        <Field label="Timeframe"><Select value={form.timeframe} onChange={uf("timeframe")} options={TIMEFRAMES} /></Field>
        <Field label="Lots"><Input value={form.lots} onChange={uf("lots")} placeholder="0.1" /></Field>
        <Field label="Entry *"><Input value={form.entry} onChange={uf("entry")} placeholder="1.03250" /></Field>
        <Field label="Stop *"><Input value={form.stop} onChange={uf("stop")} placeholder="1.02950" /></Field>
        <Field label="Target"><Input value={form.target} onChange={uf("target")} placeholder="Optional" /></Field>
        <Field label="Exit *"><Input value={form.exit_price} onChange={uf("exit_price")} placeholder="1.03720" /></Field>
        <Field label="PnL (USD) *"><Input value={form.gross_pnl} onChange={uf("gross_pnl")} placeholder="235" /></Field>
        <Field label="Swap"><Input value={form.swap} onChange={uf("swap")} placeholder="0" /></Field>
        <Field label="Score"><Select value={form.score} onChange={uf("score")} options={SCORES} /></Field>
        <Field label="Emotion"><Select value={form.emotion} onChange={uf("emotion")} options={EMOTIONS} /></Field>
      </div>

      <div className="mt-4">
        <div className="text-[11px] text-muted mb-1">Notes</div>
        <textarea
          value={form.notes}
          onChange={e => uf("notes")(e.target.value)}
          placeholder="Entry logic, position management, exit reason..."
          className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[60px] resize-y outline-none
            focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
        />
      </div>

      {/* Auto-calc preview */}
      {preview && (
        <div className="mt-4 p-3 bg-bg rounded-lg flex gap-5 flex-wrap text-xs font-mono">
          <span className="text-muted">Auto-calc:</span>
          <span>Stop pips: <b>{preview.stopPips.toFixed(5)}</b></span>
          <span>PnL pips: <b className={preview.pnlPips >= 0 ? 'text-green' : 'text-red'}>{preview.pnlPips.toFixed(5)}</b></span>
          <span>R: <b className={preview.rMultiple >= 0 ? 'text-green' : 'text-red'}>{preview.rMultiple}R</b></span>
          <span>Spread: <b>${preview.spread}</b></span>
          <span>Net: <b className={preview.netPnl >= 0 ? 'text-green' : 'text-red'}>${preview.netPnl}</b></span>
        </div>
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={handleSubmit}
          className="bg-green text-white px-7 py-2.5 rounded-lg text-sm font-semibold cursor-pointer
            hover:brightness-110 transition-all duration-200">
          {editing ? "Save Changes" : "Confirm"}
        </button>
        <button onClick={onCancel}
          className="text-muted border border-border px-5 py-2.5 rounded-lg text-sm cursor-pointer
            hover:text-text hover:border-muted transition-all duration-200">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[11px] text-muted mb-1">{label}</div>
      {children}
    </div>
  )
}
