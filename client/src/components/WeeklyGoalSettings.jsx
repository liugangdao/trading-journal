import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import { currentWeekKey } from '../lib/week'
import { GlassButton, GlassSurface } from './ui/Glass'

export default function WeeklyGoalSettings({ onCurrentGoalChange }) {
  const [week, setWeek] = useState(() => currentWeekKey())
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    api.getWeeklyGoal(week).then(goal => { if (active) setContent(goal.content) }).catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [week])
  const save = async () => {
    try {
      const goal = await api.saveWeeklyGoal(week, content)
      setContent(goal.content)
      if (week === currentWeekKey()) onCurrentGoalChange(goal.content)
      setMessage('周目标已保存')
    } catch (error) { setMessage(error.message) }
  }
  return <GlassSurface as="section" className="p-5 sm:p-6">
    <h2 className="text-base font-semibold mb-2">周目标管理</h2>
    <p className="text-xs text-muted mb-4">给本周留一句执行重点，记录交易时会显示。</p>
    <label className="block text-xs text-muted mb-3">选择周<input type="week" value={week} onChange={event => { setWeek(event.target.value); setMessage('') }} className="block mt-1 rounded-lg bg-input border border-border px-3 py-2 text-sm text-text" /></label>
    <label className="block text-xs text-muted">目标内容<textarea value={content} onChange={event => { setContent(event.target.value); setMessage('') }} maxLength={500} placeholder="例如：只做收盘确认的突破，每笔风险不超过 1R" className="block w-full mt-1 rounded-lg bg-input border border-border px-3 py-2.5 text-sm text-text min-h-24 resize-y" /></label>
    <div className="flex items-center gap-3 mt-4"><GlassButton variant="primary" onClick={save}>保存周目标</GlassButton>{message && <span className="text-xs text-muted" role="status">{message}</span>}</div>
  </GlassSurface>
}
