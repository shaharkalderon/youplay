import type { LibraryItem } from './store.ts'

/**
 * Matching for every search box in the app.
 *
 * Once items carry your own writing, searching only the fetched title is the
 * wrong shape: the whole reason to note "read before the interview" is to find
 * it again by those words. So notes, tags and the URL are all searched — the URL
 * because the platforms that publish no title are exactly the ones whose address
 * is the only thing you might remember about them.
 */
export function matchesQuery(item: LibraryItem, needle: string): boolean {
  if (!needle) return true
  return (
    item.title.toLowerCase().includes(needle) ||
    item.subtitle.toLowerCase().includes(needle) ||
    item.note.toLowerCase().includes(needle) ||
    item.url.toLowerCase().includes(needle) ||
    item.tags.some((tag) => tag.toLowerCase().includes(needle))
  )
}

/** Normalises the query once rather than per item — a full-library search runs
 *  this on every keystroke. */
export const normaliseQuery = (query: string) => query.trim().toLowerCase()

export const searchItems = (items: LibraryItem[], query: string): LibraryItem[] => {
  const needle = normaliseQuery(query)
  return needle ? items.filter((item) => matchesQuery(item, needle)) : items
}
