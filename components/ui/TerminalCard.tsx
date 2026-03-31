import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface Props {
  title?:       string
  icon?:        ReactNode
  action?:      ReactNode
  children:     ReactNode
  className?:   string
  bodyClass?:   string
  noPadding?:   boolean
  accent?:      'green' | 'red' | 'cyan' | 'amber'
}

export default function TerminalCard({
  title, icon, action, children,
  className, bodyClass, noPadding, accent = 'green',
}: Props) {
  const accentColor = {
    green: 'var(--green)',
    red:   'var(--red)',
    cyan:  'var(--cyan)',
    amber: 'var(--amber)',
  }[accent]

  return (
    <div className={clsx('term-card', className)}>
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {title && (
        <div className="term-card-header">
          <div className="term-card-title">
            {icon && <span style={{ color: accentColor }}>{icon}</span>}
            <span style={{ color: accentColor }}>{title}</span>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className={clsx(!noPadding && 'term-card-body', bodyClass)}>
        {children}
      </div>
    </div>
  )
}
