import { useState, useEffect } from 'react'

export default function MobileSheet({ open, onClose, title, children }) {
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setClosing(false)
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setVisible(false)
      document.body.style.overflow = ''
      onClose()
    }, 250)
  }

  if (!open && !visible) return null

  return (
    <div className="fixed inset-0 z-[90] sm:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${closing ? 'animate-fade-out-overlay' : 'animate-fade-in-overlay'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className={`absolute inset-0 bg-bg flex flex-col ${closing ? 'animate-sheet-down' : 'animate-sheet-up'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card pt-safe">
          <button
            onClick={handleClose}
            className="text-accent text-sm font-medium min-w-[60px] text-left active:opacity-70"
          >
            取消
          </button>
          <span className="text-text text-[15px] font-semibold">{title}</span>
          <div className="min-w-[60px]" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {children}
        </div>
      </div>
    </div>
  )
}
