import type { LibraryItem } from './store.ts'
import type { Platform } from './links.ts'
import { PLATFORMS } from './platforms.ts'

export type FilterId =
  | 'all'
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
]

export const isFilterId = (value: unknown): value is FilterId =>
  FILTERS.some((filter) => filter.id === value)

export const findFilter = (id: FilterId): Filter =>
  FILTERS.find((filter) => filter.id === id) ?? FILTERS[0]
