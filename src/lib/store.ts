import { useSyncExternalStore } from 'react'
import type { ParsedLink } from './links.ts'
import { dedupeKey } from './links.ts'
import { fetchMetadata, placeholderMetadata } from './metadata.ts'
import { liveItems, pruneTombstones } from './sync.ts'

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
  /** Stamped on every local mutation; drives last-write-wins when syncing. */
  updatedAt: number
  /**
   * Soft delete. Removals have to survive as tombstones, or a delete on one
   * device is undone by the next device that syncs an older copy back.
   */
  deletedAt: number | null
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
    // The sync fields are backfilled for libraries saved before they existed.
    const restored = parsed.map((item: LibraryItem) => ({
      ...item,
      watchedAt: item.watchedAt ?? null,
      updatedAt: item.updatedAt ?? item.addedAt ?? Date.now(),
      deletedAt: item.deletedAt ?? null,
      resolving: false,
    }))
    return pruneTombstones(restored)
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

/** The live library, without tombstones — this is what the UI renders. */
export function useLibrary(): LibraryItem[] {
  return useSyncExternalStore(subscribe, getItems, getItems)
}

let liveCache: LibraryItem[] = liveItems(items)
let liveCacheSource: LibraryItem[] = items

/** Memoised so useSyncExternalStore does not see a new array every render. */
export function getItems(): LibraryItem[] {
  if (liveCacheSource !== items) {
    liveCacheSource = items
    liveCache = liveItems(items)
  }
  return liveCache
}

/** Everything, tombstones included — for sync and merging only. */
export const getAllItems = () => items

/** Applies a merged library wholesale. Used by sync, which has already
 *  reconciled local and remote state. */
export function replaceAll(next: LibraryItem[]) {
  commit(next)
  // A merge can bring in items from another device that never resolved there.
  retryUnresolved()
}

export const has = (link: ParsedLink) =>
  getItems().some((item) => item.key === dedupeKey(link))

/**
 * Adds a link immediately with placeholder text, then fills in the real title
 * and artwork when oEmbed answers. Returns the item, or null if it was already
 * saved — sharing the same track twice should be a no-op, not a duplicate.
 */
export function addLink(link: ParsedLink): LibraryItem | null {
  const key = dedupeKey(link)
  const existing = items.find((item) => item.key === key)
  // A live entry is a duplicate; a tombstone means this link was deleted before
  // and is being saved again, which should bring it back rather than no-op.
  if (existing && !existing.deletedAt) return null

  const now = Date.now()
  const item: LibraryItem = {
    ...link,
    key,
    ...placeholderMetadata(link),
    addedAt: now,
    watchedAt: null,
    updatedAt: now,
    deletedAt: null,
    resolved: false,
    resolving: true,
  }
  commit([item, ...items.filter((entry) => entry.key !== key)])
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

/**
 * `touch` marks a change as user intent, which is what sync reconciles on.
 * Metadata arriving from oEmbed is not intent — it is a cache fill — so it must
 * not bump `updatedAt` and win a merge against a real edit on another device.
 */
function patch(key: string, changes: Partial<LibraryItem>, touch = false) {
  const index = items.findIndex((item) => item.key === key)
  if (index === -1) return
  const next = items.slice()
  next[index] = { ...next[index], ...changes, ...(touch ? { updatedAt: Date.now() } : {}) }
  commit(next)
}

/**
 * Merges imported items into the library. Existing entries always win: an
 * import adds what is missing and never overwrites or reorders what you have,
 * so importing the same file twice is a no-op rather than a duplicate pile.
 */
export function importItems(incoming: LibraryItem[]): { added: number; duplicates: number } {
  const existing = new Set(getItems().map((item) => item.key))
  const fresh = incoming.filter((item) => !existing.has(item.key))

  if (fresh.length > 0) {
    const revived = new Set(fresh.map((item) => item.key))
    commit([...fresh, ...items.filter((item) => !revived.has(item.key))])
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

/** Soft delete: the tombstone is what lets the removal survive a sync. */
export function removeItem(key: string) {
  const now = Date.now()
  patch(key, { deletedAt: now, updatedAt: now })
}

/**
 * Re-runs metadata lookup for anything still on placeholder text. Sharing into
 * the app typically opens it for a moment and then the user swipes away, which
 * kills the in-flight lookup — so unresolved items are retried on every load.
 */
export function retryUnresolved() {
  const pending = getItems().filter((item) => !item.resolved && !item.resolving)
  if (pending.length === 0) return
  pending.forEach((item) => {
    patch(item.key, { resolving: true })
    void resolve(item)
  })
}
