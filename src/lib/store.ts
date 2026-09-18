import { useSyncExternalStore } from 'react'
import type { ParsedLink } from './links.ts'
import { dedupeKey } from './links.ts'
import { canFetchMetadata, fetchMetadata, placeholderMetadata } from './metadata.ts'
import { platformInfo } from './platforms.ts'
import { addTag, hasTag, normaliseTag, removeTag, sanitiseTags } from './tags.ts'
import { isWithinFolder, normaliseFolderPath, rewriteFolder, sanitiseFolder } from './folders.ts'
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
  /**
   * Your own words about this item — why you saved it, what to do with it. The
   * link is what the internet says; this is what you say, which is the whole
   * point of keeping a second brain rather than a bookmark folder.
   */
  note: string
  /** Free-form labels, cross-cutting the platform and kind filters. See tags.ts. */
  tags: string[]
  /**
   * Where this lives: a folder path like `Work/Research`, or null for unfiled.
   *
   * One folder per item, on purpose. Tags already cover "this belongs to several
   * things at once"; a folder answers the different question of where you would
   * go looking for it. The folder tree is derived from these paths — see
   * folders.ts for why there is no registry.
   */
  folder: string | null
  /** Stamped on every local mutation; drives last-write-wins when syncing. */
  updatedAt: number
  /**
   * Soft delete. Removals have to survive as tombstones, or a delete on one
   * device is undone by the next device that syncs an older copy back.
   */
  deletedAt: number | null
  /** True once oEmbed has actually answered; false means we are showing a placeholder. */
  resolved: boolean
  /**
   * True while a metadata lookup is in flight, so the card can show a hint.
   * Purely transient: never persisted and never synced — see `inFlight`.
   */
  resolving?: boolean
}

const STORAGE_KEY = 'youplay.library.v1'

/** Long enough for a real thought, short enough that one runaway paste cannot
 *  blow the localStorage quota and take the whole library down with it. */
export const NOTE_LIMIT = 4000

/** Order-sensitive, because the order tags were added in is the order they are
 *  shown in — reordering is a real edit, not a no-op. */
const sameTagList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tag, index) => tag === b[index])

let items: LibraryItem[] = load()
const listeners = new Set<() => void>()

/**
 * Keys with a metadata lookup running right now.
 *
 * This lives in memory rather than on the item because `resolving` must never
 * outlive the page. It used to be written to storage and pushed to the server,
 * which deadlocked sync: a device that pushed an item mid-lookup published
 * `resolving: true`, every later merge pulled that back, and the retry pass
 * skips anything already marked resolving — so the title could never resolve
 * again on any device.
 */
const inFlight = new Set<string>()

/**
 * Fills in fields an item may predate.
 *
 * Applied on every way in, not just on load: a merge can hand us an item pushed
 * by a device still running an older version, which has no `note` or `tags` at
 * all. Anything that then reads `item.note.toLowerCase()` — searching, say —
 * would throw, and one stale device would take the whole screen down.
 */
function hydrate(item: LibraryItem): LibraryItem {
  return {
    ...item,
    watchedAt: item.watchedAt ?? null,
    note: typeof item.note === 'string' ? item.note : '',
    // Re-cleaned rather than trusted: the list may come from a file that was
    // hand-edited, or from a version with a different idea of what a tag is.
    tags: sanitiseTags(item.tags),
    folder: sanitiseFolder(item.folder),
    updatedAt: item.updatedAt ?? item.addedAt ?? Date.now(),
    deletedAt: item.deletedAt ?? null,
  }
}

function load(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // A lookup that was in flight when the tab closed is not "in flight" now.
    const restored = parsed.map((item: LibraryItem) => ({
      ...hydrate(item),
      resolving: false,
      // Items saved before the second line carried the URL still repeat the
      // platform's own name, which identifies nothing. Recomputed only where
      // there is no metadata to fetch and nothing was ever fetched, so a real
      // author is never overwritten. Cosmetic, so it does not stamp an edit.
      subtitle:
        !canFetchMetadata(item) && item.subtitle === platformInfo(item.platform).label
          ? placeholderMetadata(item).subtitle
          : item.subtitle,
    }))
    return pruneTombstones(restored)
  } catch {
    return []
  }
}

function commit(next: LibraryItem[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripTransient(items)))
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

/** Drops fields that describe this tab's activity rather than the library. */
export const stripTransient = (list: LibraryItem[]): LibraryItem[] =>
  list.map(({ resolving: _resolving, ...rest }) => rest)

/** Everything, tombstones included — for sync and merging only. */
export const getAllItems = () => stripTransient(items)

/** Applies a merged library wholesale. Used by sync, which has already
 *  reconciled local and remote state. */
export function replaceAll(next: LibraryItem[]) {
  // Incoming items describe the library, not this tab, so the flag is rebuilt
  // from what is genuinely running here — and anything a device on an older
  // version left out is filled in before the UI ever reads it.
  commit(next.map((item) => ({ ...hydrate(item), resolving: inFlight.has(item.key) })))
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
  // Instagram, Facebook, Reddit and the like publish no metadata a browser may
  // read, so their placeholder text — worked out from the URL — is final.
  // Marking them resolved stops the retry pass revisiting them on every load.
  const lookupPossible = canFetchMetadata(link)
  const item: LibraryItem = {
    ...link,
    key,
    ...placeholderMetadata(link),
    addedAt: now,
    watchedAt: null,
    note: '',
    tags: [],
    folder: null,
    updatedAt: now,
    deletedAt: null,
    resolved: !lookupPossible,
    resolving: lookupPossible,
  }
  commit([item, ...items.filter((entry) => entry.key !== key)])
  if (lookupPossible) void resolve(item)
  return item
}

async function resolve(item: LibraryItem) {
  inFlight.add(item.key)
  try {
    const meta = await fetchMetadata(item)
    // A rename that landed while this was in flight must not be overwritten by
    // the title we were fetching; renaming marks the item resolved.
    if (items.find((entry) => entry.key === item.key)?.resolved) return
    patch(item.key, { ...meta, resolved: true, resolving: false })
  } catch {
    patch(item.key, { resolving: false })
  } finally {
    inFlight.delete(item.key)
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
  // `touch` is essential: without a bumped updatedAt this edit loses every
  // merge, so watching something on one device would vanish when another synced.
  patch(key, { watchedAt: item.watchedAt ? null : Date.now() }, true)
}

/**
 * Gives an item your own title.
 *
 * Some platforms — Instagram, Facebook, Reddit — publish nothing a browser may
 * read, so the app can only name a link after its URL. Renaming is the way to
 * make those items mean something. It counts as user intent, so it is stamped
 * and wins a sync merge, and it marks the item resolved so no later lookup can
 * quietly replace your words.
 */
export function renameItem(key: string, title: string) {
  const trimmed = title.trim().slice(0, 200)
  if (!trimmed) return
  patch(key, { title: trimmed, resolved: true, resolving: false }, true)
}

/**
 * Saves everything the item sheet can change in one stamp.
 *
 * Title, note and tags are edited together, so they commit together: three
 * separate writes would be three `updatedAt` stamps, three renders and — worse
 * — three chances for a sync mid-edit to merge a half-saved item.
 *
 * An empty title is ignored rather than rejected: clearing the field and saving
 * means "leave the title alone", not "call this item nothing".
 */
export function editItem(
  key: string,
  changes: { title?: string; note?: string; tags?: string[]; folder?: string | null }
) {
  const item = items.find((entry) => entry.key === key)
  if (!item) return

  const title = changes.title?.trim().slice(0, 200)
  const note = changes.note?.slice(0, NOTE_LIMIT)
  const tags = changes.tags ? sanitiseTags(changes.tags) : undefined
  // `undefined` means "not part of this edit"; `null` means "unfile it", which
  // is a real change and must not be confused with the first.
  const folder =
    changes.folder === undefined
      ? undefined
      : changes.folder === null
        ? null
        : normaliseFolderPath(changes.folder)

  const next: Partial<LibraryItem> = {}
  // A title you typed yourself counts as resolved, so no later lookup can
  // quietly replace your words — the same contract as renaming.
  if (title && title !== item.title) Object.assign(next, { title, resolved: true, resolving: false })
  if (note !== undefined && note !== item.note) next.note = note
  if (tags && !sameTagList(tags, item.tags)) next.tags = tags
  if (folder !== undefined && folder !== item.folder) next.folder = folder

  // Nothing actually changed — opening the sheet and closing it again should
  // not stamp an edit that then wins a merge against a real one elsewhere.
  if (Object.keys(next).length === 0) return
  patch(key, next, true)
}

/** Adds a tag straight from a card, without opening the sheet. */
export function tagItem(key: string, raw: string) {
  const item = items.find((entry) => entry.key === key)
  if (!item) return
  const tags = addTag(item.tags, raw)
  // `addTag` hands back the same array when the tag was a duplicate or blank.
  if (tags === item.tags) return
  patch(key, { tags }, true)
}

/** Removes a tag from one item. The tag itself disappears once nothing uses it. */
export function untagItem(key: string, tag: string) {
  const item = items.find((entry) => entry.key === key)
  if (!item) return
  const tags = removeTag(item.tags, tag)
  if (tags.length === item.tags.length) return
  patch(key, { tags }, true)
}

/**
 * Renames a tag everywhere at once. One `updatedAt` per touched item, so the
 * rename survives a merge item by item rather than as an all-or-nothing batch.
 *
 * Returns the name actually stored, which is not what was typed: `#Thinking`
 * is stored as `Thinking`. Callers need that to follow the rename — pointing a
 * filter at the raw text lands on a tag nobody carries and an empty screen.
 */
export function renameTag(from: string, to: string): string | null {
  const tag = normaliseTag(to)
  if (!tag) return null
  const now = Date.now()
  let changed = false
  const next = items.map((item) => {
    if (!hasTag(item.tags, from)) return item
    changed = true
    return { ...item, tags: addTag(removeTag(item.tags, from), tag), updatedAt: now }
  })
  if (changed) commit(next)
  return tag
}

/** Drops a tag from every item that carries it. The tag then stops existing,
 *  because a tag is only ever the set of things using it. */
export function deleteTag(tag: string) {
  const now = Date.now()
  let changed = false
  const next = items.map((item) => {
    if (!hasTag(item.tags, tag)) return item
    changed = true
    return { ...item, tags: removeTag(item.tags, tag), updatedAt: now }
  })
  if (changed) commit(next)
}

/** Files an item, or unfiles it when given null. */
export function setFolder(key: string, path: string | null) {
  const item = items.find((entry) => entry.key === key)
  if (!item) return
  const folder = path === null ? null : normaliseFolderPath(path)
  if (folder === item.folder) return
  patch(key, { folder }, true)
}

/**
 * Renames a folder, carrying everything inside it along.
 *
 * Renaming `Work` to `Archive` has to move `Work/Research` to
 * `Archive/Research` as well, or half the tree is orphaned under a name that no
 * longer exists. One stamp per touched item, so the move survives a merge item
 * by item rather than all-or-nothing.
 */
export function renameFolder(from: string, to: string): string | null {
  const path = normaliseFolderPath(to)
  if (!path) return null
  const now = Date.now()
  let changed = false
  const next = items.map((item) => {
    if (!item.folder) return item
    const moved = rewriteFolder(item.folder, from, to)
    if (!moved || moved === item.folder) return item
    changed = true
    return { ...item, folder: moved, updatedAt: now }
  })
  if (changed) commit(next)
  return path
}

/**
 * Deletes a folder and everything below it, unfiling what was inside.
 *
 * Items are never removed with the folder. A folder is a place, not a container
 * that owns its contents — deleting one should lose the filing, not the things.
 */
export function deleteFolder(path: string) {
  const now = Date.now()
  let changed = false
  const next = items.map((item) => {
    if (!item.folder || !isWithinFolder(item.folder, path)) return item
    changed = true
    return { ...item, folder: null, updatedAt: now }
  })
  if (changed) commit(next)
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
  // Trust the in-memory set, not the item flag: a merged-in item can arrive
  // carrying a stale flag from whichever device wrote it.
  const pending = getItems().filter(
    (item) => !item.resolved && canFetchMetadata(item) && !inFlight.has(item.key)
  )
  if (pending.length === 0) return
  pending.forEach((item) => {
    patch(item.key, { resolving: true })
    void resolve(item)
  })
}
