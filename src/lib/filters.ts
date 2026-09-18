import type { LibraryItem } from './store.ts'
import type { Platform } from './links.ts'
import { PLATFORMS } from './platforms.ts'
import { hasTag } from './tags.ts'
import { isWithinFolder } from './folders.ts'

/**
 * Tag filters are spelled `tag:Stocks` rather than living in FILTERS, because
 * tags are data: they appear and vanish as you use them, so they cannot be a
 * fixed registry entry. Everything downstream — the remembered-filter
 * preference, the stale-filter fallback, the chip row — then needs no special
 * case, because a tag filter is just another FilterId.
 */
export const TAG_FILTER_PREFIX = 'tag:'

/** Folder filters work the same way, and for the same reason: the tree is
 *  derived from what items carry, so there is nothing fixed to register. */
export const FOLDER_FILTER_PREFIX = 'folder:'

export type TagFilterId = `${typeof TAG_FILTER_PREFIX}${string}`
export type FolderFilterId = `${typeof FOLDER_FILTER_PREFIX}${string}`

export type FilterId =
  | TagFilterId
  | FolderFilterId
  | 'all'
  | 'unfiled'
  | 'unwatched'
  | 'watched'
  | 'music'
  | 'posts'
  | 'playlists'
  | 'podcasts'
  | Platform

export type Filter = {
  id: FilterId
  label: string
  match: (item: LibraryItem) => boolean
}

/** Opens on the queue: the point of the watched state is that finished items
 *  stop competing for attention. */
export const DEFAULT_FILTER: FilterId = 'unwatched'

/** One chip per platform, built from the registry so a new platform needs no
 *  change here. Chips with nothing in them are hidden by the UI, so the row
 *  only ever shows what you actually have. */
const platformFilters: Filter[] = PLATFORMS.map((platform) => ({
  id: platform.id,
  label: platform.id === 'link' ? 'Other links' : platform.label,
  match: (item: LibraryItem) => item.platform === platform.id,
}))

export const FILTERS: Filter[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'unwatched', label: 'Unwatched', match: (i) => i.watchedAt === null },
  { id: 'watched', label: 'Watched', match: (i) => i.watchedAt !== null },
  ...platformFilters,
  { id: 'music', label: 'Music', match: (i) => ['track', 'album', 'artist'].includes(i.kind) },
  { id: 'posts', label: 'Posts', match: (i) => ['post', 'reel', 'photo'].includes(i.kind) },
  { id: 'playlists', label: 'Playlists', match: (i) => i.kind === 'playlist' },
  { id: 'podcasts', label: 'Podcasts', match: (i) => ['show', 'episode'].includes(i.kind) },
  { id: 'unfiled', label: 'Unfiled', match: (i) => i.folder === null },
]

export const tagFilterId = (tag: string): TagFilterId => `${TAG_FILTER_PREFIX}${tag}`

export const folderFilterId = (path: string): FolderFilterId =>
  `${FOLDER_FILTER_PREFIX}${path}`

export const isTagFilter = (id: FilterId): id is TagFilterId =>
  id.startsWith(TAG_FILTER_PREFIX)

export const isFolderFilter = (id: FilterId): id is FolderFilterId =>
  id.startsWith(FOLDER_FILTER_PREFIX)

/** The tag a filter id names, or null when it names something else. */
export const filterTag = (id: FilterId): string | null =>
  isTagFilter(id) ? id.slice(TAG_FILTER_PREFIX.length) : null

/** The folder a filter id names, or null when it names something else. */
export const filterFolder = (id: FilterId): string | null =>
  isFolderFilter(id) ? id.slice(FOLDER_FILTER_PREFIX.length) : null

/** Built on demand rather than looked up: a tag exists only as long as
 *  something carries it, so there is no list to find it in. */
const tagFilter = (tag: string): Filter => ({
  id: tagFilterId(tag),
  label: tag,
  match: (item) => hasTag(item.tags, tag),
})

/** Opening a folder shows what is inside it *and* inside its subfolders —
 *  a folder you have to open four times to see anything is not a folder. */
const folderFilter = (path: string): Filter => ({
  id: folderFilterId(path),
  label: path,
  match: (item) => item.folder !== null && isWithinFolder(item.folder, path),
})

const prefixed = (value: string, prefix: string) =>
  value.startsWith(prefix) && value.length > prefix.length

export const isFilterId = (value: unknown): value is FilterId =>
  typeof value === 'string' &&
  (value.startsWith(TAG_FILTER_PREFIX) || value.startsWith(FOLDER_FILTER_PREFIX)
    ? prefixed(value, TAG_FILTER_PREFIX) || prefixed(value, FOLDER_FILTER_PREFIX)
    : FILTERS.some((filter) => filter.id === value))

export const findFilter = (id: FilterId): Filter => {
  const tag = filterTag(id)
  if (tag) return tagFilter(tag)
  const folder = filterFolder(id)
  if (folder) return folderFilter(folder)
  return FILTERS.find((filter) => filter.id === id) ?? FILTERS[0]
}
