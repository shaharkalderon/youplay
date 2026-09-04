import { dedupeKey, parseLink } from './links.ts'
import type { LibraryItem } from './store.ts'

export const EXPORT_VERSION = 1

export type ExportFile = {
  app: 'youplay'
  version: number
  exportedAt: string
  items: LibraryItem[]
}

export type ImportOutcome = {
  items: LibraryItem[]
  /** Entries present in the file that could not be read as a usable link. */
  skipped: number
}

export function buildExport(items: LibraryItem[], now = new Date()): ExportFile {
  return {
    app: 'youplay',
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    items,
  }
}

export function exportFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `youplay-library-${stamp}.json`
}

const asString = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.slice(0, max) : ''

/**
 * Thumbnails go straight into an <img src>, so only allow ordinary http(s)
 * URLs — never `javascript:`, `data:` or anything else a hand-edited or
 * hostile file might carry.
 */
function safeThumbnail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function safeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : Date.now()
}

/** Watched state is optional: anything unusable means "still in the queue". */
function safeWatchedAt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Reads an export file back into library items.
 *
 * Nothing in the file is trusted beyond the link itself: platform, kind, id and
 * the canonical URL are all re-derived by running the stored URL back through
 * the parser. A file with a mismatched or hand-edited `platform` therefore
 * cannot smuggle in an item that the app could not have created itself.
 */
export function parseImport(text: string): ImportOutcome {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  const raw = (data as { items?: unknown })?.items
  if (!Array.isArray(raw)) {
    throw new Error('That file does not look like a YouPlay export.')
  }

  const items: LibraryItem[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const entry of raw) {
    const source = (entry as { url?: unknown; appUri?: unknown })?.url
    const link = typeof source === 'string' ? parseLink(source) : null
    if (!link) {
      skipped++
      continue
    }

    const key = dedupeKey(link)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)

    const record = entry as Record<string, unknown>
    const title = asString(record.title)
    const thumbnail = safeThumbnail(record.thumbnail)

    items.push({
      ...link,
      key,
      title: title || `${link.kind} · ${link.id}`,
      subtitle: asString(record.subtitle, 200),
      thumbnail,
      addedAt: safeTimestamp(record.addedAt),
      watchedAt: safeWatchedAt(record.watchedAt),
      // Anything without real metadata is re-fetched after the import.
      resolved: Boolean(title) && Boolean(thumbnail),
      resolving: false,
    })
  }

  return { items, skipped }
}

/** Hands the export to the browser as a download. */
export function downloadExport(items: LibraryItem[]) {
  const json = JSON.stringify(buildExport(items), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = exportFilename()
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Revoked on the next tick so the download has taken the reference.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
