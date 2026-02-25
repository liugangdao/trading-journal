import { useState } from 'react'
import Input from './ui/Input'

export default function WeeklyNotes({ notes, onAdd, onDelete }) {
  const [form, setForm] = useState({ week: "", lesson: "", plan: "" })

  const add = () => {
    if (!form.week) return
    onAdd(form)
    setForm({ week: "", lesson: "", plan: "" })
  }

  return (
    <div>
      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h3 className="text-base font-bold mb-5">New Review Note</h3>
        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-muted mb-1">Week</div>
            <Input value={form.week} onChange={v => setForm(f => ({ ...f, week: v }))} placeholder="e.g. 2026-W08" />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">Key Lessons</div>
            <textarea
              value={form.lesson}
              onChange={e => setForm(f => ({ ...f, lesson: e.target.value }))}
              placeholder="What was the biggest lesson this week?"
              className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y outline-none
                focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted mb-1">Improvement Plan</div>
            <textarea
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              placeholder="What to improve next week?"
              className="w-full bg-input text-text border border-border rounded-lg px-3 py-2 text-sm min-h-[60px] resize-y outline-none
                focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all duration-200 font-sans"
            />
          </div>
        </div>
        <button onClick={add}
          className="mt-4 bg-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer
            hover:brightness-110 transition-all duration-200">
          Save Note
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <div className="text-4xl mb-3 opacity-50">No reviews yet</div>
          <p className="text-sm">Spend 15 minutes each weekend to review - consistency is key</p>
        </div>
      ) : (
        notes.map(n => (
          <div key={n.id} className="bg-card border border-border rounded-xl p-4 mb-3 hover:border-border/80 transition-all duration-200">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-sm">{n.week}</span>
              <button onClick={() => onDelete(n.id)}
                className="text-red text-xs cursor-pointer hover:text-red/80 transition-colors">
                Delete
              </button>
            </div>
            {n.lesson && (
              <div className="mb-2">
                <div className="text-[11px] text-gold font-semibold mb-1">Key Lessons</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{n.lesson}</div>
              </div>
            )}
            {n.plan && (
              <div>
                <div className="text-[11px] text-accent font-semibold mb-1">Improvement Plan</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{n.plan}</div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
