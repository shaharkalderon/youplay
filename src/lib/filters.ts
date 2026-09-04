import type { LibraryItem } from './store.ts'

export type FilterId =
  | 'all'
  | 'unwatched'
  | 'watched'
  | 'youtube'
  | 'spotify'
  | 'music'
  | 'playlists'
  | 'podcasts'

export type Filter = {
  id: FilterId
  label: string
  match: (item: LibraryItem) => boolean
}

/** Opens on the queue: the point of the watched state is that finished items
 *  stop competing for attention. */
export const DEFAULT_FILTER: FilterId = 'unwatched'

export const FILTERS: Filter[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'unwatched', label: 'Unwatched', match: (i) => i.watchedAt === null },
  { id: 'watched', label: 'Watched', match: (i) => i.watchedAt !== null },
  { id: 'youtube', label: 'YouTube', match: (i) => i.platform === 'youtube' },
  { id: 'spotify', label: 'Spotify', match: (i) => i.platform === 'spotify' },
  { id: 'music', label: 'Music', match: (i) => ['track', 'album', 'artist'].includes(i.kind) },
  { id: 'playlists', label: 'Playlists', match: (i) => i.kind === 'playlist' },
  { id: 'podcasts', label: 'Podcasts', match: (i) => ['show', 'episode'].includes(i.kind) },
]

export const isFilterId = (value: unknown): value is FilterId =>
  FILTERS.some((filter) => filter.id === value)

export const findFilter = (id: FilterId): Filter =>
  FILTERS.find((filter) => filter.id === id) ?? FILTERS[0]
