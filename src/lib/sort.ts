import type { LibraryItem } from './store.ts'

export type SortOrder = 'newest' | 'oldest'

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
}

export const isSortOrder = (value: unknown): value is SortOrder =>
  value === 'newest' || value === 'oldest'

/** Sort by when the link was saved. Ties break on key so the order is stable. */
export function sortItems<T extends Pick<LibraryItem, 'addedAt' | 'key'>>(
  items: T[],
  order: SortOrder
): T[] {
  const direction = order === 'newest' ? -1 : 1
  return [...items].sort((a, b) => {
    if (a.addedAt !== b.addedAt) return (a.addedAt - b.addedAt) * direction
    return a.key.localeCompare(b.key)
  })
}
