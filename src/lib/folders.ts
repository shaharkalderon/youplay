/**
 * Folders: where a thing lives, as opposed to tags, which are what it is about.
 * An item sits in at most one folder; it can carry any number of tags.
 *
 * A folder is a **path stored on the item** — `Work/Research` — and the tree is
 * derived from the paths in use, exactly as the tag list is derived from the
 * tags in use. Nothing keeps a separate registry of folders.
 *
 * That is a deliberate trade. A registry would need its own synced table, its
 * own RPCs and a SQL migration (the followed-channels store already carries
 * that wart, and a second one is worse), plus orphan handling when a folder is
 * deleted while another device still has items in it. Deriving the tree means
 * folders sync for free inside the library that already syncs, and a folder can
 * never disagree with its contents.
 *
 * The one thing derivation cannot express is an **empty** folder — a path no
 * item uses yet does not exist. Since "make a folder, then fill it" is a normal
 * way to work, `drafts.ts`-style local state covers that gap: see `draftFolders`
 * below, which are per-device and disappear the moment something real lands in
 * them.
 */

export const FOLDER_SEPARATOR = '/'
/** Deep enough to organise, shallow enough that the sidebar stays readable. */
export const MAX_FOLDER_DEPTH = 4
const MAX_SEGMENT_LENGTH = 32

/**
 * Cleans a typed path into its stored form, or null when nothing usable is
 * left. Case is preserved and matching is case-insensitive, like tags: a folder
 * is a name, not a slug.
 */
export function normaliseFolderPath(raw: string): string | null {
  const segments = raw
    .split(FOLDER_SEPARATOR)
    .map((segment) => segment.replace(/\s+/g, ' ').trim().slice(0, MAX_SEGMENT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_FOLDER_DEPTH)
  return segments.length > 0 ? segments.join(FOLDER_SEPARATOR) : null
}

/** Reads a path from untrusted input — an import file, or an older version. */
export const sanitiseFolder = (value: unknown): string | null =>
  typeof value === 'string' ? normaliseFolderPath(value) : null

export const folderSegments = (path: string): string[] => path.split(FOLDER_SEPARATOR)

/** The folder's own name, without its ancestors. */
export function folderName(path: string): string {
  const segments = folderSegments(path)
  return segments[segments.length - 1] ?? path
}

export const folderDepth = (path: string): number => folderSegments(path).length

/** The containing folder, or null at the top level. */
export function parentFolder(path: string): string | null {
  const segments = folderSegments(path)
  return segments.length > 1 ? segments.slice(0, -1).join(FOLDER_SEPARATOR) : null
}

/** Every folder on the way down to this one, itself included. */
export function ancestorFolders(path: string): string[] {
  const segments = folderSegments(path)
  return segments.map((_, index) => segments.slice(0, index + 1).join(FOLDER_SEPARATOR))
}

export const sameFolder = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * True when `path` is `ancestor` or sits inside it.
 *
 * The separator check is what stops "Work" claiming "Workshop" — a plain
 * `startsWith` would put every unrelated folder that happens to share a prefix
 * inside it.
 */
export function isWithinFolder(path: string, ancestor: string): boolean {
  const a = path.toLowerCase()
  const b = ancestor.toLowerCase()
  return a === b || a.startsWith(b + FOLDER_SEPARATOR)
}

export type FolderNode = {
  /** Canonical path, in the spelling shown to the reader. */
  path: string
  name: string
  depth: number
  /** Items filed here exactly. */
  direct: number
  /** Items filed here or anywhere below — what the sidebar counts. */
  total: number
  children: FolderNode[]
}

type Filed = { folder: string | null }

/**
 * Builds the folder tree from the paths in use, plus any empty folders passed
 * in. Ancestors are implied: filing something in `Work/Research` creates `Work`
 * whether or not anything sits directly in it.
 */
export function buildFolderTree(items: Filed[], extra: string[] = []): FolderNode[] {
  // Spelling counts for each level of each path, so one stray "work" does not
  // rename the "Work" you have used twenty times - the rule tags follow too.
  // Keyed by the lowercased path down to that segment, because "Work/research"
  // and "Work/Research" are the same folder competing over one name.
  const spellings = new Map<string, Map<string, number>>()

  const note = (path: string, weight: number) => {
    const segments = folderSegments(path)
    for (let index = 0; index < segments.length; index++) {
      const lower = segments.slice(0, index + 1).join(FOLDER_SEPARATOR).toLowerCase()
      const bucket = spellings.get(lower) ?? new Map<string, number>()
      bucket.set(segments[index], (bucket.get(segments[index]) ?? 0) + weight)
      spellings.set(lower, bucket)
    }
  }

  for (const item of items) if (item.folder) note(item.folder, 1)
  // Empty folders exist but name nothing, so they never outvote a real spelling.
  for (const path of extra) note(path, 0)

  /**
   * Canonical paths, shallowest first.
   *
   * Each level is rebuilt on its parent's canonical spelling rather than kept
   * as typed, or an empty `work/Ideas` would hang a child spelled `work` under
   * a parent spelled `Work` - the same folder wearing two names in one tree.
   */
  const canonical = new Map<string, string>()
  const byDepth = [...spellings.keys()].sort(
    (a, b) => folderDepth(a) - folderDepth(b) || a.localeCompare(b)
  )
  for (const lower of byDepth) {
    const bucket = spellings.get(lower) as Map<string, number>
    const [best] = [...bucket.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const parentLower = parentFolder(lower)
    const prefix = parentLower ? `${canonical.get(parentLower) ?? parentLower}${FOLDER_SEPARATOR}` : ''
    canonical.set(lower, prefix + best[0])
  }

  const direct = new Map<string, number>()
  const total = new Map<string, number>()
  for (const item of items) {
    if (!item.folder) continue
    const lower = item.folder.toLowerCase()
    direct.set(lower, (direct.get(lower) ?? 0) + 1)
    for (const ancestor of ancestorFolders(item.folder)) {
      const key = ancestor.toLowerCase()
      total.set(key, (total.get(key) ?? 0) + 1)
    }
  }

  const nodes = new Map<string, FolderNode>()
  for (const [lower, path] of canonical) {
    nodes.set(lower, {
      path,
      name: folderName(path),
      depth: folderDepth(path),
      direct: direct.get(lower) ?? 0,
      total: total.get(lower) ?? 0,
      children: [],
    })
  }

  const roots: FolderNode[] = []
  for (const [lower, node] of nodes) {
    const parentLower = parentFolder(lower)
    const container = parentLower ? nodes.get(parentLower)?.children : roots
    ;(container ?? roots).push(node)
  }

  const sortTree = (list: FolderNode[]): FolderNode[] => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    for (const node of list) sortTree(node.children)
    return list
  }
  return sortTree(roots)
}

/** Flattens the tree depth-first, which is the order the sidebar draws it in. */
export function flattenFolders(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolders(node.children)])
}

/**
 * Rewrites a path when its ancestor is renamed, keeping everything below it.
 * Returns null when the path is not inside `from`, so callers can skip the write.
 */
export function rewriteFolder(path: string, from: string, to: string): string | null {
  if (!isWithinFolder(path, from)) return null
  const rest = path.slice(from.length)
  return normaliseFolderPath(to + rest)
}
