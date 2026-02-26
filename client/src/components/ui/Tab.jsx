export default function Tab({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-accent text-white shadow-lg shadow-accent/20'
          : 'text-muted hover:text-text hover:bg-hover'
        }`}
    >
      {children}
    </button>
  )
}
