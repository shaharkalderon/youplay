import { getAllItems, replaceAll } from './store.ts'
import type { LibraryItem } from './store.ts'
import { getClient } from './supabase.ts'
import { mergeItems, pruneTombstones } from './sync.ts'

const TABLE = 'libraries'

export type SyncState =
  | { status: 'idle'; lastSyncedAt: number | null }
  | { status: 'syncing'; lastSyncedAt: number | null }
  | { status: 'error'; lastSyncedAt: number | null; message: string }

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
 * The merge is the same pure function both devices run, so it does not matter
 * which one syncs first. We only write back when the merge actually differs
 * from what the server already had, to avoid two devices ping-ponging writes.
 *
 * Concurrent calls share one run: focus, interval and manual sync all fire at
 * roughly the same moment, and three overlapping round-trips would be pointless.
 */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    setState({ status: 'syncing', lastSyncedAt: state.lastSyncedAt })
    try {
      const supabase = await getClient()
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error('Not signed in.')

      const { data, error } = await supabase
        .from(TABLE)
        .select('items')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error

      const remote: LibraryItem[] = Array.isArray(data?.items) ? data.items : []
      const local = getAllItems()
      const merged = pruneTombstones(mergeItems(local, remote))

      // Local first: the merge may have brought in items or deletions.
      replaceAll(merged)

      if (!sameLibrary(merged, remote)) {
        const { error: writeError } = await supabase
          .from(TABLE)
          .upsert({ user_id: user.id, items: merged }, { onConflict: 'user_id' })
        if (writeError) throw writeError
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
