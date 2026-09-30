import { GlassButton } from './Glass'

export default function Pagination({ total, limit, offset, onChange }) {
  if (!limit || total <= limit) {
    return total > 0 ? <div className="mt-4 text-xs text-muted">共 {total} 条记录</div> : null
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const goTo = (page) => {
    onChange((page - 1) * limit)
  }

  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted">
      <span className="text-xs">共 {total} 笔交易</span>
      <div className="flex items-center gap-1">
        <GlassButton
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="上一页"
          className="journal-icon-button"
        >‹</GlassButton>
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="px-1 text-xs">...</span>
            ) : (
              <GlassButton
                key={p}
                onClick={() => goTo(p)}
                aria-current={p === currentPage ? 'page' : undefined}
                variant={p === currentPage ? 'primary' : 'ghost'}
                className="journal-icon-button"
              >{p}</GlassButton>
            )
          )}
        </div>
        <span className="sm:hidden text-xs">{currentPage}/{totalPages}</span>
        <GlassButton
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="下一页"
          className="journal-icon-button"
        >›</GlassButton>
      </div>
      <span className="text-xs hidden sm:inline">每页 {limit} 笔</span>
    </div>
  )
}
