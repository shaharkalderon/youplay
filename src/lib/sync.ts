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

/**
 * Ties must resolve to the same winner on every device, never "whichever copy
 * is local". Preferring the local record looks harmless but is order-dependent:
 * two devices then each keep their own version and push it back, disagreeing
 * forever. Equal timestamps do happen — a legacy edit that failed to stamp
 * updatedAt, or two edits within the same millisecond.
 */
function pickWinner(a: LibraryItem, b: LibraryItem): LibraryItem {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b

  // A delete is never lost to a coin flip.
  if (Boolean(a.deletedAt) !== Boolean(b.deletedAt)) return a.deletedAt ? a : b

  // Then the further-along watched state: having watched something is a real
  // action, whereas not having watched it is just the absence of one.
  const aWatched = a.watchedAt ?? 0
  const bWatched = b.watchedAt ?? 0
  if (aWatched !== bWatched) return aWatched > bWatched ? a : b

  // Finally prefer resolved metadata, so a tie never reverts a real title.
  if (a.resolved !== b.resolved) return a.resolved ? a : b

  return a
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

/** Drops tombstones old enough that every device has surely seen them. */
export function pruneTombstones(items: LibraryItem[], now = Date.now()): LibraryItem[] {
  return items.filter(
    (item) => !item.deletedAt || now - item.deletedAt < TOMBSTONE_TTL_MS
  )
}

/** The live library: what the UI shows. */
export const liveItems = (items: LibraryItem[]) => items.filter((item) => !item.deletedAt)
