export type Layout = 'grid' | 'compact' | 'list' | 'rows'

export const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'compact', label: 'Compact' },
  { id: 'list', label: 'List' },
  { id: 'rows', label: 'Rows' },
]

export const isLayout = (value: unknown): value is Layout =>
  LAYOUTS.some((layout) => layout.id === value)
