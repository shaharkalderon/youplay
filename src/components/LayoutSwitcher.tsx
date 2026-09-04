import type { ComponentType } from 'react'
import { LAYOUTS, type Layout } from '../lib/layout.ts'
import { setLayout } from '../lib/preferences.ts'
import { CompactIcon, GridIcon, ListIcon, RowsIcon } from './Icons'

const ICONS: Record<Layout, ComponentType> = {
  grid: GridIcon,
  compact: CompactIcon,
  list: ListIcon,
  rows: RowsIcon,
}

export function LayoutSwitcher({ value }: { value: Layout }) {
  return (
    <div className="layout-switcher" role="group" aria-label="Layout">
      {LAYOUTS.map(({ id, label }) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            className="layout-option"
            aria-pressed={id === value}
            aria-label={`${label} layout`}
            title={`${label} layout`}
            onClick={() => setLayout(id)}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
