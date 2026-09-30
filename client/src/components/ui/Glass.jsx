export function GlassSurface({ as: Component = 'div', className = '', children, ...props }) {
  return <Component className={`glass-surface ${className}`} {...props}>{children}</Component>
}

export function GlassButton({ variant = 'secondary', type = 'button', className = '', children, ...props }) {
  return <button type={type} className={`glass-button glass-button--${variant} ${className}`} {...props}>{children}</button>
}

export function GlassSegmentedControl({ options, value, onChange, label, disabled = false }) {
  return <div role="group" aria-label={label} className="glass-segmented">
    {options.map(option => <button key={option.value} type="button" disabled={disabled}
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className={`glass-segment ${value === option.value ? 'is-selected' : ''}`}>{option.label}</button>)}
  </div>
}
