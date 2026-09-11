import type { LibraryItem } from './store.ts'

/**
 * Merge logic for syncing one library across devices. Kept pure and separate
 * from any particular backend: whatever ends up holding the data, two devices
 * that edited while apart have to be reconciled the same way.
 *
 * The model is last-write-wins per item, keyed on the link itself:
 *
 * - Every mutation stamps `updatedAt`, so the newer edit wins.
 * - Deletes are **tombstones** (`deletedAt`), not removals. Without them a
 *   delete on one device is silently undone by any device that still has the
 *   item — it looks like the deletion "didn't take".
 * - `addedAt` takes the earlier of the two: when you first saved the link is a
 *   fact about the past, not something a later sync should rewrite.
 * - Metadata is a cache, not intent. If the winner never resolved its title but
 *   the loser did, keep the resolved copy rather than reverting to a placeholder.
 */

/** How long tombstones are kept before being pruned. A device offline longer
 *  than this can resurrect a deleted item; the alternative is unbounded growth. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type SyncSnapshot = {
  app: 'youplay'
  version: number
  /** When the snapshot was written, used only for display and conflict reporting. */
  updatedAt: number
  /** Includes tombstones — they are part of the state, not noise. */
  items: LibraryItem[]
}

export const SYNC_VERSION = 1

export type SyncRecord = {
  key: string
  addedAt: number
  updatedAt: number
  deletedAt: number | null
}

/**
 * The part of conflict resolution every synced record shares: the newer edit
 * wins, and on a tie a delete is never lost to a coin flip. Returns null when
 * that does not decide it, so each record type can add its own tie-breaks.
 */
function pickByTime<T extends SyncRecord>(a: T, b: T): T | null {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) return a.deletedAt ? a : b
  return null
}

/** JSON with sorted keys, so two devices serialise the same record identically
 *  even when they built its object in a different property order. */
function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([x], [y]) =>
            x < y ? -1 : x > y ? 1 : 0
          )
        )
      : inner
  )
}

/** Last resort for a true tie: decide on content, which every device agrees on. */
function byContent<T>(a: T, b: T): T {
  return stableKey(a) >= stableKey(b) ? a : b
}

/**
 * Ties must resolve to the same winner on every device, never "whichever copy
 * is local". Preferring the local record looks harmless but is order-dependent:
 * two devices then each keep their own version and push it back, disagreeing
 * forever. Equal timestamps do happen — a legacy edit that failed to stamp
 * updatedAt, or two edits within the same millisecond.
 */
function pickWinner(a: LibraryItem, b: LibraryItem): LibraryItem {
  const byTime = pickByTime(a, b)
  if (byTime) return byTime

  // Then the further-along watched state: having watched something is a real
  // action, whereas not having watched it is just the absence of one.
  const aWatched = a.watchedAt ?? 0
  const bWatched = b.watchedAt ?? 0
  if (aWatched !== bWatched) return aWatched > bWatched ? a : b

  // Prefer resolved metadata, so a tie never reverts a real title.
  if (a.resolved !== b.resolved) return a.resolved ? a : b

  // Anything still different — a title YouTube has since renamed, say — is
  // settled on content rather than by keeping the local copy.
  return byContent(a, b)
}

function reconcile(a: LibraryItem, b: LibraryItem): LibraryItem {
  const winner = pickWinner(a, b)
  const loser = winner === a ? b : a

  const merged: LibraryItem = {
    ...winner,
    addedAt: Math.min(a.addedAt, b.addedAt),
  }

  if (!merged.deletedAt && !merged.resolved && loser.resolved) {
    return {
      ...merged,
      title: loser.title,
      subtitle: loser.subtitle,
      thumbnail: loser.thumbnail,
      resolved: true,
    }
  }

  return merged
}

/** Reconciles two libraries into one. Commutative: order of arguments does not
 *  change the result, which is what makes it safe to run on either device. */
export function mergeItems(local: LibraryItem[], remote: LibraryItem[]): LibraryItem[] {
  const byKey = new Map<string, LibraryItem>()

  for (const item of [...local, ...remote]) {
    const existing = byKey.get(item.key)
    byKey.set(item.key, existing ? reconcile(existing, item) : item)
  }

  return [...byKey.values()]
}

/**
 * The same merge for any other synced list — currently followed channels.
 * Timestamps and tombstones decide it; a true tie is settled on content.
 */
export function mergeRecords<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const byKey = new Map<string, T>()

  for (const record of [...local, ...remote]) {
    const existing = byKey.get(record.key)
    if (!existing) {
      byKey.set(record.key, record)
      continue
    }
    const winner = pickByTime(existing, record) ?? byContent(existing, record)
    byKey.set(record.key, { ...winner, addedAt: Math.min(existing.addedAt, record.addedAt) })
  }

  return [...byKey.values()]
}

/** Drops tombstones old enough that every device has surely seen them. */
export function pruneTombstones<T extends SyncRecord>(items: T[], now = Date.now()): T[] {
  return items.filter(
    (item) => !item.deletedAt || now - item.deletedAt < TOMBSTONE_TTL_MS
  )
}

/** The live records: what the UI shows. */
export const liveItems = <T extends { deletedAt: number | null }>(items: T[]) =>
  items.filter((item) => !item.deletedAt)
