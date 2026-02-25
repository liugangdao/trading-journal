export default function KpiCard({ label, value, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex-1 min-w-[140px]
      hover:border-accent/30 transition-all duration-300">
      <div className="text-[11px] text-muted tracking-wide uppercase mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color || undefined }}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  )
}
