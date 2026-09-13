import { kindLabel, type Kind, type Platform } from './links.ts'
import { PLATFORMS, platformInfo } from './platforms.ts'
import type { LibraryItem } from './store.ts'

export type KindCount = { kind: Kind; label: string; count: number }
export type PlatformCount = { platform: Platform; label: string; color: string; count: number }

export type LibraryStats = {
  total: number
  watched: number
  unwatched: number
  /** Only platforms you actually have, in registry order. */
  byPlatform: PlatformCount[]
  byKind: KindCount[]
  firstAddedAt: number | null
  lastAddedAt: number | null
  lastWatchedAt: number | null
  /** 0-100, rounded. Zero for an empty library rather than NaN. */
  watchedPercent: number
}

/** Expects the live library — tombstones are not part of what you have saved. */
export function libraryStats(items: LibraryItem[]): LibraryStats {
  const watched = items.filter((item) => item.watchedAt !== null)

  const kinds = new Map<Kind, number>()
  for (const item of items) kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1)

  const byKind = [...kinds.entries()]
    .map(([kind, count]) => ({ kind, label: kindLabel(kind), count }))
    // Biggest first, then alphabetical so equal counts do not reorder randomly.
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const byPlatform = PLATFORMS.map((platform) => ({
    platform: platform.id,
    label: platform.id === 'link' ? 'Other' : platform.label,
    color: platformInfo(platform.id).color,
    count: items.filter((item) => item.platform === platform.id).length,
  })).filter((entry) => entry.count > 0)

  const maxOf = (values: number[]) => (values.length ? Math.max(...values) : null)
  const minOf = (values: number[]) => (values.length ? Math.min(...values) : null)

  return {
    total: items.length,
    watched: watched.length,
    unwatched: items.length - watched.length,
    byPlatform,
    byKind,
    firstAddedAt: minOf(items.map((item) => item.addedAt)),
    lastAddedAt: maxOf(items.map((item) => item.addedAt)),
    lastWatchedAt: maxOf(watched.map((item) => item.watchedAt as number)),
    watchedPercent: items.length === 0 ? 0 : Math.round((watched.length / items.length) * 100),
  }
}
