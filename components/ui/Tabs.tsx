'use client'
import { useState, ReactNode } from 'react'

export interface TabItem {
  id:      string
  label:   string
  icon?:   ReactNode
  badge?:  number
  content: ReactNode
}

interface Props {
  tabs:         TabItem[]
  defaultTab?:  string
  onChange?:    (id: string) => void
}

export default function Tabs({ tabs, defaultTab, onChange }: Props) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)

  function select(id: string) {
    setActive(id)
    onChange?.(id)
  }

  const current = tabs.find(t => t.id === active)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="tab-list">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-trigger ${active === tab.id ? 'active' : ''}`}
            onClick={() => select(tab.id)}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 text-2xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    fontSize: '9px',
                    background: 'rgba(0,255,65,0.15)',
                    color: 'var(--green)',
                  }}>
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {current?.content}
      </div>
    </div>
  )
}
