import { BookOpen, CalendarDays, ChartNoAxesCombined, LogOut, Moon, PenLine, Settings2, Sun } from 'lucide-react'
import { GlassButton } from './ui/Glass'

const tabs = [
  { key: 'record', label: '记录', Icon: PenLine },
  { key: 'history', label: '交易记录', mobileLabel: '交易', Icon: BookOpen },
  { key: 'calendar', label: '日历', Icon: CalendarDays },
  { key: 'stats', label: '统计', Icon: ChartNoAxesCombined },
  { key: 'settings', label: '设置', Icon: Settings2 },
]

function NavigationItems({ active, onChange, mobile = false }) {
  return tabs.map(({ key, label, mobileLabel, Icon }) => <button key={key} type="button"
    onClick={() => onChange(key)} aria-current={active === key ? 'page' : undefined}
    className={`journal-nav-item ${active === key ? 'is-selected' : ''}`}>
    <Icon size={mobile ? 20 : 17} strokeWidth={1.8} aria-hidden="true" />
    <span>{mobile ? mobileLabel || label : label}</span>
  </button>)
}

export function JournalHeader({ active, onChange, theme, onToggleTheme, onLogout }) {
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  return <header className="journal-header">
    <div className="journal-header-inner">
      <div className="journal-brand"><span className="journal-brand-mark"><PenLine size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <div><h1>交易手记</h1><p>写下判断，回头看执行</p></div>
      </div>
      <nav aria-label="主导航" className="journal-desktop-nav glass-chrome"><NavigationItems active={active} onChange={onChange} /></nav>
      <div className="flex items-center gap-2">
        <GlassButton className="journal-icon-button" onClick={onToggleTheme} aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'} title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}><ThemeIcon size={18} aria-hidden="true" /></GlassButton>
        <GlassButton className="journal-icon-button" onClick={onLogout} aria-label="退出登录" title="退出登录"><LogOut size={18} aria-hidden="true" /></GlassButton>
      </div>
    </div>
  </header>
}

export function JournalMobileNavigation({ active, onChange }) {
  return <nav aria-label="手机主导航" className="journal-mobile-nav glass-chrome"><NavigationItems active={active} onChange={onChange} mobile /></nav>
}
