import { getAllChannels, replaceAllChannels, sanitiseChannels } from './channels.ts'
import { getAllItems, replaceAll, stripTransient } from './store.ts'
import type { LibraryItem } from './store.ts'
import { rpc } from './supabase.ts'
import { getSyncCode } from './synccode.ts'
import { mergeItems, mergeRecords, pruneTombstones, type SyncRecord } from './sync.ts'

export type SyncState = {
  status: 'idle' | 'syncing' | 'error'
  lastSyncedAt: number | null
  message?: string
  /**
   * Followed channels sync through their own functions, added after library
   * sync. `needs-setup` means the updated SQL has not been run yet: the
   * library still syncs, and channels stay on each device until it is.
   */
  channels: 'ok' | 'needs-setup' | null
}

let state: SyncState = { status: 'idle', lastSyncedAt: null, channels: null }
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
 * Pull, merge, push — for the library, then for followed channels.
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
    setState({ status: 'syncing', lastSyncedAt: state.lastSyncedAt, channels: state.channels })
    try {
      const remoteRaw = await rpc<LibraryItem[] | null>('library_pull', { p_id: code })
      const remote = Array.isArray(remoteRaw) ? remoteRaw : []

      const merged = pruneTombstones(mergeItems(getAllItems(), remote))

      // Local first: the merge may have brought in items or deletions.
      replaceAll(merged)

      if (!sameLibrary(merged, remote)) {
        await rpc<string>('library_push', { p_id: code, p_items: stripTransient(merged) })
      }

      const channels = await syncChannels(code)
      setState({ status: 'idle', lastSyncedAt: Date.now(), channels })
    } catch (error) {
      setState({
        status: 'error',
        lastSyncedAt: state.lastSyncedAt,
        channels: state.channels,
        message: (error as Error).message || 'Sync failed.',
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

async function syncChannels(code: string): Promise<SyncState['channels']> {
  let raw: unknown
  try {
    raw = await rpc<unknown>('channels_pull', { p_id: code })
  } catch (error) {
    // PostgREST names the missing function in its message. Treat that as
    // "not set up yet" rather than failing the whole run — the library sync
    // above has already succeeded and should be reported as such.
    if (/channels_pull/.test((error as Error).message)) return 'needs-setup'
    throw error
  }

  // Channels from the server were written by whoever holds the code, so they
  // are re-validated before being merged, like anything read from storage.
  const remote = sanitiseChannels(raw)
  const merged = pruneTombstones(mergeRecords(getAllChannels(), remote))
  replaceAllChannels(merged)

  if (!sameRecords(merged, remote)) {
    await rpc<string>('channels_push', { p_id: code, p_channels: merged })
  }
  return 'ok'
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

function sameRecords(a: SyncRecord[], b: SyncRecord[]): boolean {
  if (a.length !== b.length) return false
  const index = new Map(b.map((record) => [record.key, record]))
  return a.every((record) => {
    const other = index.get(record.key)
    return (
      other !== undefined &&
      other.updatedAt === record.updatedAt &&
      other.deletedAt === record.deletedAt
    )
  })
}
