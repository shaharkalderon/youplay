import { useSyncExternalStore } from 'react'
import type { ParsedLink } from './links.ts'
import { dedupeKey } from './links.ts'
import { fetchMetadata, placeholderMetadata } from './metadata.ts'

export type LibraryItem = ParsedLink & {
  key: string
  title: string
  subtitle: string
  thumbnail: string | null
  addedAt: number
  /**
   * When this was marked watched, or null while it is still in the queue. A
   * timestamp rather than a flag so the card can say when, and so a future
   * "recently watched" view has something to sort on.
   */
  watchedAt: number | null
  /** True once oEmbed has actually answered; false means we are showing a placeholder. */
  resolved: boolean
  /** True while a lookup is in flight, so the card can show a loading hint. */
  resolving?: boolean
}

const STORAGE_KEY = 'youplay.library.v1'

let items: LibraryItem[] = load()
const listeners = new Set<() => void>()

function load(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // A lookup that was in flight when the tab closed is not "in flight" now.
    // `watchedAt` is backfilled for libraries saved before the field existed.
    return parsed.map((item: LibraryItem) => ({
      ...item,
      watchedAt: item.watchedAt ?? null,
      resolving: false,
    }))
  } catch {
    return []
  }
}

function commit(next: LibraryItem[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Quota or private-mode failures must not take the in-memory library down.
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useLibrary(): LibraryItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items)
}

export const getItems = () => items

export const has = (link: ParsedLink) => items.some((item) => item.key === dedupeKey(link))

/**
 * Adds a link immediately with placeholder text, then fills in the real title
 * and artwork when oEmbed answers. Returns the item, or null if it was already
 * saved — sharing the same track twice should be a no-op, not a duplicate.
 */
export function addLink(link: ParsedLink): LibraryItem | null {
  const key = dedupeKey(link)
  if (items.some((item) => item.key === key)) return null

  const item: LibraryItem = {
    ...link,
    key,
    ...placeholderMetadata(link),
    addedAt: Date.now(),
    watchedAt: null,
    resolved: false,
    resolving: true,
  }
  commit([item, ...items])
  void resolve(item)
  return item
}

async function resolve(item: LibraryItem) {
  try {
    const meta = await fetchMetadata(item)
    patch(item.key, { ...meta, resolved: true, resolving: false })
  } catch {
    patch(item.key, { resolving: false })
  }
}

function patch(key: string, changes: Partial<LibraryItem>) {
  const index = items.findIndex((item) => item.key === key)
  if (index === -1) return
  const next = items.slice()
  next[index] = { ...next[index], ...changes }
  commit(next)
}

/**
 * Merges imported items into the library. Existing entries always win: an
 * import adds what is missing and never overwrites or reorders what you have,
 * so importing the same file twice is a no-op rather than a duplicate pile.
 */
export function importItems(incoming: LibraryItem[]): { added: number; duplicates: number } {
  const existing = new Set(items.map((item) => item.key))
  const fresh = incoming.filter((item) => !existing.has(item.key))

  if (fresh.length > 0) {
    commit([...fresh, ...items])
    // Imported rows may carry no metadata; fill them in like any other add.
    retryUnresolved()
  }

  return { added: fresh.length, duplicates: incoming.length - fresh.length }
}

/** Marks an item watched, or puts it back in the queue if it already was. */
export function toggleWatched(key: string) {
  const item = items.find((entry) => entry.key === key)
  if (!item) return
  patch(key, { watchedAt: item.watchedAt ? null : Date.now() })
}

export function removeItem(key: string) {
  commit(items.filter((item) => item.key !== key))
}

/**
 * Re-runs metadata lookup for anything still on placeholder text. Sharing into
 * the app typically opens it for a moment and then the user swipes away, which
 * kills the in-flight lookup — so unresolved items are retried on every load.
 */
export function retryUnresolved() {
  const pending = items.filter((item) => !item.resolved && !item.resolving)
  if (pending.length === 0) return
  pending.forEach((item) => {
    patch(item.key, { resolving: true })
    void resolve(item)
  })
}
