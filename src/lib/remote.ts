import { getAllItems, replaceAll } from './store.ts'
import type { LibraryItem } from './store.ts'
import { rpc } from './supabase.ts'
import { getSyncCode } from './synccode.ts'
import { mergeItems, pruneTombstones } from './sync.ts'

export type SyncState = {
  status: 'idle' | 'syncing' | 'error'
  lastSyncedAt: number | null
  message?: string
}

let state: SyncState = { status: 'idle', lastSyncedAt: null }
const listeners = new Set<() => void>()

export const subscribeSync = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getSyncState = () => state

function setState(next: SyncState) {
  state = next
  listeners.forEach((fn) => fn())
}

let inFlight: Promise<void> | null = null

/**
 * Pull, merge, push.
 *
 * Both devices run the same pure merge, so it does not matter which syncs
 * first. We only write back when the result differs from what the server
 * already had, so two idle devices do not ping-pong writes at each other.
 *
 * Overlapping calls share one run: load, focus and the interval often fire at
 * once, and three simultaneous round-trips would achieve nothing.
 */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight

  const code = getSyncCode()
  if (!code) return Promise.resolve()

  inFlight = (async () => {
    setState({ status: 'syncing', lastSyncedAt: state.lastSyncedAt })
    try {
      const remoteRaw = await rpc<LibraryItem[] | null>('library_pull', { p_id: code })
      const remote = Array.isArray(remoteRaw) ? remoteRaw : []

      const merged = pruneTombstones(mergeItems(getAllItems(), remote))

      // Local first: the merge may have brought in items or deletions.
      replaceAll(merged)

      if (!sameLibrary(merged, remote)) {
        await rpc<string>('library_push', { p_id: code, p_items: merged })
      }

      setState({ status: 'idle', lastSyncedAt: Date.now() })
    } catch (error) {
      setState({
        status: 'error',
        lastSyncedAt: state.lastSyncedAt,
        message: (error as Error).message || 'Sync failed.',
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** Cheap equality on the fields sync cares about, to skip pointless writes. */
function sameLibrary(a: LibraryItem[], b: LibraryItem[]): boolean {
  if (a.length !== b.length) return false
  const index = new Map(b.map((item) => [item.key, item]))
  return a.every((item) => {
    const other = index.get(item.key)
    return (
      other !== undefined &&
      other.updatedAt === item.updatedAt &&
      other.deletedAt === item.deletedAt &&
      other.watchedAt === item.watchedAt &&
      other.resolved === item.resolved
    )
  })
}
