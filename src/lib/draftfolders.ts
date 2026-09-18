import { useSyncExternalStore } from 'react'
import { isWithinFolder, normaliseFolderPath, rewriteFolder, sameFolder } from './folders.ts'

/**
 * Folders you have made but not yet filled.
 *
 * The folder tree is derived from the paths items carry (see `folders.ts`), so a
 * folder with nothing in it does not exist anywhere. This holds those until
 * something lands in them, which is what makes "make a folder, then fill it"
 * work at all.
 *
 * Per device and deliberately not synced. A draft is a half-finished gesture
 * rather than a fact about the library, and syncing one would mean an empty
 * folder made on a phone appearing on a laptop that has no use for it. The
 * moment a real item is filed there the folder stops being a draft and travels
 * with that item like any other path.
 */

const STORAGE_KEY = 'youplay.draftFolders.v1'
/** A cap so an abandoned pile of empties cannot crowd out the real tree. */
const LIMIT = 40

function load(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return dedupe(raw.map(sanitise).filter((path): path is string => path !== null))
  } catch {
    return []
  }
}

const sanitise = (value: unknown): string | null =>
  typeof value === 'string' ? normaliseFolderPath(value) : null

const dedupe = (paths: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path.toLowerCase())) continue
    seen.add(path.toLowerCase())
    out.push(path)
  }
  return out.slice(0, LIMIT)
}

let drafts: string[] = load()
const listeners = new Set<() => void>()

function commit(next: string[]) {
  drafts = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // A failed write only costs the empty folders, not anything you have filed.
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getDraftFolders = () => drafts

export const useDraftFolders = (): string[] =>
  useSyncExternalStore(subscribe, getDraftFolders, getDraftFolders)

/** Returns the stored path, or null when the input named no folder. */
export function addDraftFolder(raw: string): string | null {
  const path = normaliseFolderPath(raw)
  if (!path) return null
  if (drafts.some((draft) => sameFolder(draft, path))) return path
  commit(dedupe([path, ...drafts]))
  return path
}

export function removeDraftFolder(path: string) {
  // Its children go too: deleting a folder cannot leave its subfolders behind
  // with no way to reach them.
  const next = drafts.filter((draft) => !isWithinFolder(draft, path))
  if (next.length !== drafts.length) commit(next)
}

/** Keeps empty folders in step when their ancestor is renamed. */
export function renameDraftFolder(from: string, to: string) {
  let changed = false
  const next = drafts.map((draft) => {
    const moved = rewriteFolder(draft, from, to)
    if (!moved || moved === draft) return draft
    changed = true
    return moved
  })
  if (changed) commit(dedupe(next))
}
