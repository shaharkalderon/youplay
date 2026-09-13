// Run with: node scripts/test-links.ts  (node strips the types natively)
import assert from 'node:assert/strict'
import { parseLink, dedupeKey } from '../src/lib/links.ts'
import { relativeTime } from '../src/lib/time.ts'
import { sortItems } from '../src/lib/sort.ts'
import { buildExport, exportFilename, parseImport } from '../src/lib/transfer.ts'
import { DEFAULT_FILTER, FILTERS, findFilter, isFilterId } from '../src/lib/filters.ts'
import { mergeItems, mergeRecords, pruneTombstones, liveItems, TOMBSTONE_TTL_MS } from '../src/lib/sync.ts'
import { libraryStats } from '../src/lib/stats.ts'
import { isSyncCode, normaliseSyncCode } from '../src/lib/synccode.ts'
import {
  addLink,
  getAllItems,
  removeItem,
  renameItem,
  stripTransient,
  toggleWatched,
} from '../src/lib/store.ts'
import {
  looksLikeChannelLink,
  parseChannelInput,
  parseChannelResponse,
  parseUploadsResponse,
  sanitiseResolvedChannel,
} from '../src/lib/youtube.ts'
import { buildFeed } from '../src/lib/feed.ts'
import {
  canFetchMetadata,
  decodeEntities,
  oembedEndpoint,
  placeholderMetadata,
  textFromEmbedHtml,
} from '../src/lib/metadata.ts'
import { addChannel, getAllChannels, getChannels, removeChannel } from '../src/lib/channels.ts'

let passed = 0
const check = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
  } catch (error) {
    console.error(`FAIL  ${name}\n      ${(error as Error).message}`)
    process.exitCode = 1
  }
}

const expect = (input: string, platform: string, kind: string, id: string) =>
  check(input, () => {
    const link = parseLink(input)
    assert.ok(link, 'expected a parse result')
    assert.equal(link.platform, platform)
    assert.equal(link.kind, kind)
    assert.equal(link.id, id)
  })

const reject = (input: string) =>
  check(`reject ${input}`, () => assert.equal(parseLink(input), null))

// --- YouTube ---
expect('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://youtu.be/dQw4w9WgXcQ', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://youtu.be/dQw4w9WgXcQ?t=42', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://www.youtube.com/shorts/abcdefghijk', 'youtube', 'short', 'abcdefghijk')
expect('https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'video', 'dQw4w9WgXcQ')
expect('https://www.youtube.com/live/dQw4w9WgXcQ', 'youtube', 'video', 'dQw4w9WgXcQ')
expect(
  'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
  'youtube', 'playlist', 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'
)

// A /watch URL carrying a list should stay the video, not become the playlist.
check('watch + list prefers the video', () => {
  const link = parseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLFgquLnL59alCl')
  assert.equal(link?.kind, 'video')
  assert.equal(link?.id, 'dQw4w9WgXcQ')
})

// --- Spotify ---
expect('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', 'spotify', 'track', '4cOdK2wGLETKBW3PvgPWqT')
expect('https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT', 'spotify', 'track', '4cOdK2wGLETKBW3PvgPWqT')
expect('spotify:album:4cOdK2wGLETKBW3PvgPWqT', 'spotify', 'album', '4cOdK2wGLETKBW3PvgPWqT')
expect('https://open.spotify.com/episode/4cOdK2wGLETKBW3PvgPWqT', 'spotify', 'episode', '4cOdK2wGLETKBW3PvgPWqT')
expect('https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT', 'spotify', 'artist', '4cOdK2wGLETKBW3PvgPWqT')

// --- Shared text, as share sheets actually send it ---
expect(
  'Check this out https://youtu.be/dQw4w9WgXcQ?si=xyz via @YouTube',
  'youtube', 'video', 'dQw4w9WgXcQ'
)
expect(
  'Never Gonna Give You Up\nhttps://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123',
  'spotify', 'track', '4cOdK2wGLETKBW3PvgPWqT'
)
check('trailing punctuation is trimmed', () => {
  const link = parseLink('watch this: https://youtu.be/dQw4w9WgXcQ.')
  assert.equal(link?.id, 'dQw4w9WgXcQ')
})

// --- Canonical output ---
check('canonical urls and app uris', () => {
  assert.equal(
    parseLink('https://youtu.be/dQw4w9WgXcQ')?.url,
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  )
  assert.equal(
    parseLink('spotify:track:4cOdK2wGLETKBW3PvgPWqT')?.url,
    'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'
  )
  assert.equal(
    parseLink('https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT')?.appUri,
    'spotify:track:4cOdK2wGLETKBW3PvgPWqT'
  )
})

// Different surface forms of the same content must collapse to one entry.
check('dedupe key is form-independent', () => {
  const a = parseLink('https://youtu.be/dQw4w9WgXcQ')!
  const b = parseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=X')!
  assert.equal(dedupeKey(a), dedupeKey(b))

  const c = parseLink('spotify:track:4cOdK2wGLETKBW3PvgPWqT')!
  const d = parseLink('https://open.spotify.com/intl-fr/track/4cOdK2wGLETKBW3PvgPWqT?si=1')!
  assert.equal(dedupeKey(c), dedupeKey(d))
})

// --- what parses now, and what still does not ---
//
// Any URL is saveable since the generic platform was added: a link the app has
// not been taught about is still worth keeping. Only input that is not a URL at
// all is refused.
check('formerly unknown links are kept rather than refused', () => {
  const cases: [string, string, string][] = [
    ['https://example.com/watch?v=dQw4w9WgXcQ', 'link', 'example.com/watch?v=dQw4w9WgXcQ'],
    ['https://vimeo.com/12345', 'vimeo', '12345'],
    // A malformed id on a known host is still a working URL, so it is kept as a
    // plain link rather than thrown away.
    ['https://open.spotify.com/track/tooshort', 'link', 'open.spotify.com/track/tooshort'],
    ['https://www.youtube.com/watch?v=short', 'link', 'youtube.com/watch?v=short'],
  ]
  for (const [input, platform, id] of cases) {
    const link = parseLink(input)!
    assert.equal(link.platform, platform, input)
    assert.equal(link.id, id, input)
  }
})

// A channel URL now parses as a plain link, so the app has to test for channels
// first — otherwise following a channel would quietly save it as a link.
check('a YouTube channel URL is a channel first and a link second', () => {
  assert.equal(looksLikeChannelLink('https://www.youtube.com/@RickAstleyYT'), true)
  assert.equal(parseLink('https://www.youtube.com/@RickAstleyYT')!.platform, 'link')
})

reject('just some text')
reject('')
reject('   ')

// --- relative time ---
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0)
const ago = (ms: number) => relativeTime(NOW - ms, NOW)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

check('relative time buckets', () => {
  assert.equal(ago(5 * SECOND), 'just now')
  assert.equal(ago(MINUTE), '1 minute ago')
  assert.equal(ago(5 * MINUTE), '5 minutes ago')
  assert.equal(ago(HOUR), '1 hour ago')
  assert.equal(ago(7 * HOUR), '7 hours ago')
  assert.equal(ago(DAY), '1 day ago')
  assert.equal(ago(3 * DAY), '3 days ago')
  assert.equal(ago(8 * DAY), '1 week ago')
  assert.equal(ago(21 * DAY), '3 weeks ago')
  assert.equal(ago(45 * DAY), '1 month ago')
  assert.equal(ago(200 * DAY), '6 months ago')
  assert.equal(ago(400 * DAY), '1 year ago')
  assert.equal(ago(800 * DAY), '2 years ago')
})

// A timestamp from the future (clock skew, edited storage) must not read as negative.
check('future timestamps degrade to "just now"', () => {
  assert.equal(relativeTime(NOW + 10 * DAY, NOW), 'just now')
})

// --- sorting ---
const row = (key: string, addedAt: number) => ({ key, addedAt })
const sample = [row('b', 200), row('a', 100), row('c', 300)]
const keys = (order: 'newest' | 'oldest') => sortItems(sample, order).map((r) => r.key)

check('newest first', () => assert.deepEqual(keys('newest'), ['c', 'b', 'a']))
check('oldest first', () => assert.deepEqual(keys('oldest'), ['a', 'b', 'c']))

check('sorting does not mutate the input', () => {
  const before = sample.map((r) => r.key)
  sortItems(sample, 'oldest')
  assert.deepEqual(sample.map((r) => r.key), before)
})

// Two links saved in the same millisecond must not shuffle between renders.
check('ties are broken stably by key', () => {
  const tied = [row('z', 500), row('a', 500), row('m', 500)]
  assert.deepEqual(sortItems(tied, 'newest').map((r) => r.key), ['a', 'm', 'z'])
  assert.deepEqual(sortItems(tied, 'oldest').map((r) => r.key), ['a', 'm', 'z'])
})

// --- export / import ---
const libraryItem = {
  ...parseLink('https://youtu.be/dQw4w9WgXcQ')!,
  key: 'youtube:video:dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  subtitle: 'Rick Astley',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  addedAt: 1_700_000_000_000,
  watchedAt: null,
  resolved: true,
}

const roundTrip = (items: unknown[]) =>
  parseImport(JSON.stringify({ ...buildExport(items as never), items }))

check('export/import round-trips an item intact', () => {
  const { items, skipped } = roundTrip([libraryItem])
  assert.equal(skipped, 0)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Never Gonna Give You Up')
  assert.equal(items[0].subtitle, 'Rick Astley')
  assert.equal(items[0].addedAt, 1_700_000_000_000)
  assert.equal(items[0].key, 'youtube:video:dQw4w9WgXcQ')
  assert.equal(items[0].resolved, true)
  assert.equal(items[0].watchedAt, null)
})

check('watched state survives a round trip', () => {
  const { items } = roundTrip([{ ...libraryItem, watchedAt: 1_710_000_000_000 }])
  assert.equal(items[0].watchedAt, 1_710_000_000_000)
})

check('unusable watched values mean "still queued"', () => {
  for (const watchedAt of [NaN, -1, 0, 'yes', {}, undefined]) {
    const { items } = roundTrip([{ ...libraryItem, watchedAt }])
    assert.equal(items[0].watchedAt, null, `should reject ${String(watchedAt)}`)
  }
})

check('export filename carries the date', () => {
  assert.equal(exportFilename(new Date('2026-09-04T10:00:00Z')), 'youplay-library-2026-09-04.json')
})

check('export envelope is self-describing', () => {
  const file = buildExport([libraryItem] as never, new Date('2026-09-04T10:00:00Z'))
  assert.equal(file.app, 'youplay')
  assert.equal(file.version, 1)
  assert.equal(file.exportedAt, '2026-09-04T10:00:00.000Z')
})

check('rejects files that are not exports', () => {
  assert.throws(() => parseImport('not json'), /valid JSON/)
  assert.throws(() => parseImport('{"nope":1}'), /YouPlay export/)
  assert.throws(() => parseImport('[]'), /YouPlay export/)
})

check('unreadable entries are counted, not fatal', () => {
  const { items, skipped } = roundTrip([
    libraryItem,
    { url: 'not a url at all' },
    { url: 42 },
    {},
  ])
  assert.equal(items.length, 1)
  assert.equal(skipped, 3)
})

check('duplicates inside one file collapse', () => {
  const { items, skipped } = roundTrip([
    libraryItem,
    { ...libraryItem, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  ])
  assert.equal(items.length, 1)
  assert.equal(skipped, 1)
})

// The file is user-editable, so identity fields are re-derived rather than trusted.
check('spoofed identity fields are re-derived from the url', () => {
  const { items } = roundTrip([
    { ...libraryItem, platform: 'spotify', kind: 'album', id: 'evil', key: 'spotify:album:evil' },
  ])
  assert.equal(items[0].platform, 'youtube')
  assert.equal(items[0].kind, 'video')
  assert.equal(items[0].id, 'dQw4w9WgXcQ')
  assert.equal(items[0].key, 'youtube:video:dQw4w9WgXcQ')
})

check('hostile thumbnails are dropped', () => {
  for (const thumbnail of ['javascript:alert(1)', 'data:text/html,<script>', 'not a url', 12]) {
    const { items } = roundTrip([{ ...libraryItem, thumbnail }])
    assert.equal(items[0].thumbnail, null, `should reject ${String(thumbnail)}`)
    assert.equal(items[0].resolved, false, 'no artwork means it gets re-fetched')
  }
  const { items } = roundTrip([{ ...libraryItem, thumbnail: 'https://example.com/a.jpg' }])
  assert.equal(items[0].thumbnail, 'https://example.com/a.jpg')
})

check('bad timestamps fall back to now', () => {
  for (const addedAt of [NaN, -1, 'yesterday', null]) {
    const { items } = roundTrip([{ ...libraryItem, addedAt }])
    assert.ok(items[0].addedAt > 0 && Number.isFinite(items[0].addedAt))
  }
})

// --- filters ---
const asItem = (over: Record<string, unknown>) => ({ ...libraryItem, ...over }) as never
const matches = (id: string, item: unknown) => findFilter(id as never).match(item as never)

check('watched filters split on watchedAt', () => {
  assert.equal(matches('unwatched', asItem({ watchedAt: null })), true)
  assert.equal(matches('unwatched', asItem({ watchedAt: 1 })), false)
  assert.equal(matches('watched', asItem({ watchedAt: 1 })), true)
  assert.equal(matches('watched', asItem({ watchedAt: null })), false)
  assert.equal(matches('all', asItem({ watchedAt: null })), true)
})

check('content filters match their kinds', () => {
  assert.equal(matches('music', asItem({ kind: 'album' })), true)
  assert.equal(matches('music', asItem({ kind: 'video' })), false)
  assert.equal(matches('podcasts', asItem({ kind: 'episode' })), true)
  assert.equal(matches('playlists', asItem({ kind: 'playlist' })), true)
  assert.equal(matches('spotify', asItem({ platform: 'spotify' })), true)
})

check('only known filter ids are accepted from storage', () => {
  assert.equal(isFilterId('unwatched'), true)
  assert.equal(isFilterId('nonsense'), false)
  assert.equal(isFilterId(null), false)
  assert.ok(FILTERS.some((f) => f.id === DEFAULT_FILTER))
})

// An unknown id must not blow up the render; it falls back to the first filter.
check('findFilter falls back for unknown ids', () => {
  assert.equal(findFilter('nope' as never).id, 'all')
})

// --- sync merge ---
const T = 1_700_000_000_000
const entry = (key: string, over: Record<string, unknown> = {}) =>
  ({
    ...libraryItem,
    key,
    addedAt: T,
    updatedAt: T,
    watchedAt: null,
    deletedAt: null,
    resolved: true,
    ...over,
  }) as never

const byKey = (items: readonly unknown[]) =>
  Object.fromEntries((items as { key: string }[]).map((i) => [i.key, i]))

check('merge unions items from both devices', () => {
  const merged = mergeItems([entry('a')], [entry('b')])
  assert.deepEqual(new Set(merged.map((i) => i.key)), new Set(['a', 'b']))
})

check('the newer edit wins', () => {
  const merged = mergeItems(
    [entry('a', { updatedAt: T + 100, watchedAt: T + 100 })],
    [entry('a', { updatedAt: T, watchedAt: null })]
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].watchedAt, T + 100)
})

// The whole reason tombstones exist.
check('a delete is not resurrected by a stale copy', () => {
  const deleted = entry('a', { updatedAt: T + 100, deletedAt: T + 100 })
  const stale = entry('a', { updatedAt: T })
  assert.equal(mergeItems([deleted], [stale])[0].deletedAt, T + 100)
  assert.equal(mergeItems([stale], [deleted])[0].deletedAt, T + 100)
  assert.equal(liveItems(mergeItems([stale], [deleted])).length, 0)
})

check('re-adding after a delete wins on recency', () => {
  const deleted = entry('a', { updatedAt: T, deletedAt: T })
  const readded = entry('a', { updatedAt: T + 500, deletedAt: null })
  assert.equal(mergeItems([deleted], [readded])[0].deletedAt, null)
})

// Order must not matter, or two devices reach different states from one merge.
check('merge is commutative', () => {
  const left = [entry('a', { updatedAt: T + 1 }), entry('b', { deletedAt: T, updatedAt: T })]
  const right = [entry('a', { updatedAt: T }), entry('c')]
  assert.deepEqual(byKey(mergeItems(left, right)), byKey(mergeItems(right, left)))
})

// A tie must not be resolved as "prefer my own copy", or two devices each keep
// their own version and push it back at each other indefinitely.
check('a tie on watched state resolves the same way on both devices', () => {
  const watched = entry('a', { updatedAt: T, watchedAt: T + 10 })
  const notWatched = entry('a', { updatedAt: T, watchedAt: null })
  assert.equal(mergeItems([watched], [notWatched])[0].watchedAt, T + 10)
  assert.equal(mergeItems([notWatched], [watched])[0].watchedAt, T + 10)
})

check('a tie on metadata prefers the resolved copy', () => {
  const good = entry('a', { updatedAt: T, resolved: true, title: 'Real' })
  const placeholder = entry('a', { updatedAt: T, resolved: false, title: 'video · a' })
  assert.equal(mergeItems([good], [placeholder])[0].title, 'Real')
  assert.equal(mergeItems([placeholder], [good])[0].title, 'Real')
})

check('a tie is broken deterministically, deletion first', () => {
  const kept = entry('a', { updatedAt: T })
  const gone = entry('a', { updatedAt: T, deletedAt: T })
  assert.equal(mergeItems([kept], [gone])[0].deletedAt, T)
  assert.equal(mergeItems([gone], [kept])[0].deletedAt, T)
})

check('addedAt keeps the earliest save', () => {
  const merged = mergeItems(
    [entry('a', { addedAt: T + 5000, updatedAt: T + 5000 })],
    [entry('a', { addedAt: T, updatedAt: T })]
  )
  assert.equal(merged[0].addedAt, T)
})

// Metadata is a cache, so a placeholder must not overwrite a resolved title.
check('resolved metadata survives against an unresolved winner', () => {
  const merged = mergeItems(
    [entry('a', { updatedAt: T + 100, resolved: false, title: 'video · abc', thumbnail: null })],
    [entry('a', { updatedAt: T, resolved: true, title: 'Real Title', thumbnail: 'https://x/y.jpg' })]
  )
  assert.equal(merged[0].title, 'Real Title')
  assert.equal(merged[0].thumbnail, 'https://x/y.jpg')
  assert.equal(merged[0].resolved, true)
})

check('merging a library with itself changes nothing', () => {
  const lib = [entry('a'), entry('b', { deletedAt: T })]
  assert.deepEqual(byKey(mergeItems(lib, lib)), byKey(lib))
})

check('old tombstones are pruned, live items never are', () => {
  const now = T + TOMBSTONE_TTL_MS + 1
  const kept = pruneTombstones(
    [entry('live'), entry('fresh', { deletedAt: now - 1000 }), entry('old', { deletedAt: T })],
    now
  )
  assert.deepEqual(new Set(kept.map((i) => i.key)), new Set(['live', 'fresh']))
})

// --- profile stats ---
const statItem = (over: Record<string, unknown>) => ({ ...libraryItem, ...over }) as never

check('stats on an empty library are zeroes, not NaN', () => {
  const s = libraryStats([])
  assert.equal(s.total, 0)
  assert.equal(s.watchedPercent, 0)
  assert.equal(s.firstAddedAt, null)
  assert.equal(s.lastWatchedAt, null)
  assert.deepEqual(s.byKind, [])
  assert.deepEqual(s.byPlatform, [])
})

check('stats count platforms, kinds and watched state', () => {
  const s = libraryStats([
    statItem({ key: 'a', platform: 'youtube', kind: 'video', watchedAt: 5, addedAt: 100 }),
    statItem({ key: 'b', platform: 'youtube', kind: 'video', watchedAt: null, addedAt: 200 }),
    statItem({ key: 'c', platform: 'spotify', kind: 'album', watchedAt: null, addedAt: 50 }),
    statItem({ key: 'd', platform: 'spotify', kind: 'track', watchedAt: 9, addedAt: 300 }),
  ])
  assert.equal(s.total, 4)
  assert.deepEqual(
    s.byPlatform.map((p) => [p.label, p.count]),
    [['YouTube', 2], ['Spotify', 2]]
  )
  assert.equal(s.watched, 2)
  assert.equal(s.unwatched, 2)
  assert.equal(s.watchedPercent, 50)
  assert.equal(s.firstAddedAt, 50)
  assert.equal(s.lastAddedAt, 300)
  assert.equal(s.lastWatchedAt, 9)
  assert.deepEqual(s.byKind[0], { kind: 'video', label: 'Video', count: 2 })
})

check('equal kind counts order alphabetically, not arbitrarily', () => {
  const s = libraryStats([
    statItem({ key: 'a', kind: 'track' }),
    statItem({ key: 'b', kind: 'album' }),
  ])
  assert.deepEqual(s.byKind.map((k) => k.label), ['Album', 'Track'])
})

check('watched percent rounds', () => {
  const s = libraryStats([
    statItem({ key: 'a', watchedAt: 1 }),
    statItem({ key: 'b', watchedAt: null }),
    statItem({ key: 'c', watchedAt: null }),
  ])
  assert.equal(s.watchedPercent, 33)
})

// --- sync codes ---
const CODE = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'

check('valid codes are recognised', () => {
  assert.equal(isSyncCode(CODE), true)
  assert.equal(normaliseSyncCode(CODE), CODE)
  assert.equal(normaliseSyncCode(`  ${CODE.toUpperCase()}  `), CODE)
})

check('a pasted setup link yields the code', () => {
  assert.equal(
    normaliseSyncCode(`https://shaharkalderon.github.io/youplay/?sync=${CODE}`),
    CODE
  )
})

check('rubbish is rejected rather than half-accepted', () => {
  for (const bad of ['', '   ', 'not-a-code', CODE.slice(0, -1), `${CODE}extra`, '12345']) {
    assert.equal(normaliseSyncCode(bad), null, `should reject ${JSON.stringify(bad)}`)
  }
  assert.equal(isSyncCode(null), false)
  assert.equal(isSyncCode(42), false)
})

// --- store mutations stamp updatedAt ---
//
// Every user edit has to bump updatedAt or it silently loses every sync merge.
// A watched toggle once shipped without it: the item changed locally and was
// then reverted by the next device to sync. These guard that path.

const seed = () => {
  const link = parseLink('https://youtu.be/dQw4w9WgXcQ')!
  const added = addLink(link)
  assert.ok(added, 'expected a fresh item')
  return added
}

check('adding stamps updatedAt', () => {
  const item = seed()
  assert.equal(typeof item.updatedAt, 'number')
  assert.equal(item.updatedAt, item.addedAt)
  assert.equal(item.deletedAt, null)
})

check('marking watched bumps updatedAt', () => {
  const item = getAllItems().find((i) => i.id === 'dQw4w9WgXcQ')!
  const before = item.updatedAt
  toggleWatched(item.key)
  const after = getAllItems().find((i) => i.key === item.key)!
  assert.ok(after.watchedAt, 'should now be watched')
  assert.ok(after.updatedAt >= before, 'updatedAt must move forward')
  assert.ok(
    after.updatedAt >= (after.watchedAt as number) - 5,
    'updatedAt must reflect the moment of the edit, not the original save'
  )
})

check('un-watching also bumps updatedAt', () => {
  const item = getAllItems().find((i) => i.id === 'dQw4w9WgXcQ')!
  toggleWatched(item.key)
  const after = getAllItems().find((i) => i.key === item.key)!
  assert.equal(after.watchedAt, null)
  assert.ok(after.updatedAt >= item.updatedAt)
})

check('removing tombstones and stamps rather than dropping the row', () => {
  const item = getAllItems().find((i) => i.id === 'dQw4w9WgXcQ')!
  removeItem(item.key)
  const after = getAllItems().find((i) => i.key === item.key)
  assert.ok(after, 'the row must survive as a tombstone')
  assert.ok(after.deletedAt, 'deletedAt must be set')
  assert.equal(after.updatedAt, after.deletedAt)
})

check('transient resolving state is never part of the synced payload', () => {
  const stripped = stripTransient([
    { key: 'k', resolving: true, title: 't' } as never,
  ])
  assert.equal('resolving' in stripped[0], false)
  assert.equal(getAllItems().some((i) => 'resolving' in i), false)
})

// --- channel input parsing ---
const RICK = 'UCuAXFkgsw1L7xaCfnd5JJOw'

check('channel links resolve to the right kind of lookup', () => {
  const cases: [string, string, string][] = [
    ['@RickAstleyYT', 'handle', 'RickAstleyYT'],
    ['https://www.youtube.com/@RickAstleyYT', 'handle', 'RickAstleyYT'],
    ['https://www.youtube.com/@RickAstleyYT/videos', 'handle', 'RickAstleyYT'],
    ['youtube.com/@RickAstleyYT', 'handle', 'RickAstleyYT'],
    ['https://m.youtube.com/@RickAstleyYT', 'handle', 'RickAstleyYT'],
    [`https://www.youtube.com/channel/${RICK}`, 'id', RICK],
    [RICK, 'id', RICK],
    ['https://www.youtube.com/user/RickAstleyVEVO', 'username', 'RickAstleyVEVO'],
    ['https://www.youtube.com/c/RickAstley', 'handle', 'RickAstley'],
    ['https://youtu.be/dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/abcdefghijk', 'video', 'abcdefghijk'],
    ['Watch this: https://www.youtube.com/@RickAstleyYT!', 'handle', 'RickAstleyYT'],
    ['RickAstleyYT', 'handle', 'RickAstleyYT'],
  ]
  for (const [input, by, value] of cases) {
    assert.deepEqual(parseChannelInput(input), { by, value }, input)
  }
})

check('non-ASCII handles survive percent-encoding', () => {
  assert.deepEqual(parseChannelInput('https://www.youtube.com/@%E3%83%86%E3%82%B9%E3%83%88'), {
    by: 'handle',
    value: 'テスト',
  })
})

check('things that are not channels are rejected', () => {
  for (const input of ['', '   ', '@ab', 'hello world', 'https://vimeo.com/123', 'https://open.spotify.com/artist/x']) {
    assert.equal(parseChannelInput(input), null, JSON.stringify(input))
  }
})

// Paste and share use the stricter test, so ordinary text never triggers a lookup.
check('only unmistakable channel links are routed to "follow"', () => {
  assert.equal(looksLikeChannelLink('https://www.youtube.com/@RickAstleyYT'), true)
  assert.equal(looksLikeChannelLink(`see https://youtube.com/channel/${RICK}`), true)
  assert.equal(looksLikeChannelLink('@RickAstleyYT'), true)
  assert.equal(looksLikeChannelLink('RickAstleyYT'), false)
  assert.equal(looksLikeChannelLink('https://youtu.be/dQw4w9WgXcQ'), false)
  assert.equal(looksLikeChannelLink('just some notes'), false)
})

// --- API response parsing ---
check('a channel response yields title, handle, avatar and uploads playlist', () => {
  const channel = parseChannelResponse({
    items: [
      {
        id: RICK,
        snippet: {
          title: 'Rick Astley',
          customUrl: '@rickastleyyt',
          thumbnails: {
            default: { url: 'https://yt3.ggpht.com/small' },
            medium: { url: 'https://yt3.ggpht.com/medium' },
          },
        },
        contentDetails: { relatedPlaylists: { uploads: 'UUuAXFkgsw1L7xaCfnd5JJOw' } },
      },
    ],
  })
  assert.deepEqual(channel, {
    id: RICK,
    title: 'Rick Astley',
    handle: '@rickastleyyt',
    thumbnail: 'https://yt3.ggpht.com/medium',
    uploadsPlaylistId: 'UUuAXFkgsw1L7xaCfnd5JJOw',
  })
})

check('a missing uploads playlist falls back to the UU form of the id', () => {
  const channel = parseChannelResponse({ items: [{ id: RICK, snippet: { title: 'R' } }] })
  assert.equal(channel?.uploadsPlaylistId, 'UUuAXFkgsw1L7xaCfnd5JJOw')
  assert.equal(channel?.handle, null)
})

check('empty or malformed channel responses give null, not a half channel', () => {
  assert.equal(parseChannelResponse({ items: [] }), null)
  assert.equal(parseChannelResponse({}), null)
  assert.equal(parseChannelResponse(null), null)
  assert.equal(parseChannelResponse({ items: [{ id: 'not-a-channel-id' }] }), null)
})

check('channel avatars must be https', () => {
  const channel = parseChannelResponse({
    items: [{ id: RICK, snippet: { title: 'R', thumbnails: { medium: { url: 'javascript:alert(1)' } } } }],
  })
  assert.equal(channel?.thumbnail, null)
})

const uploads = {
  items: [
    {
      snippet: {
        title: 'New song',
        publishedAt: '2026-09-10T20:00:00Z',
        resourceId: { kind: 'youtube#video', videoId: 'aaaaaaaaaaa' },
        thumbnails: { high: { url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg' } },
        videoOwnerChannelTitle: 'Rick Astley',
        videoOwnerChannelId: RICK,
      },
      contentDetails: { videoId: 'aaaaaaaaaaa', videoPublishedAt: '2026-09-09T08:00:00Z' },
    },
    // Private: no publish time, no uploader.
    {
      snippet: { title: 'Private video', resourceId: { videoId: 'bbbbbbbbbbb' }, thumbnails: {} },
      contentDetails: { videoId: 'bbbbbbbbbbb' },
    },
    // Deleted, even if a date lingers: the placeholder title with no uploader.
    {
      snippet: { title: 'Deleted video', resourceId: { videoId: 'ccccccccccc' } },
      contentDetails: { videoId: 'ccccccccccc', videoPublishedAt: '2026-09-09T08:00:00Z' },
    },
    {
      snippet: { title: 'No thumbnails', resourceId: { videoId: 'ddddddddddd' } },
      contentDetails: { videoId: 'ddddddddddd', videoPublishedAt: '2026-09-08T08:00:00Z' },
    },
    {
      snippet: { title: 'Bad id', resourceId: { videoId: 'short' } },
      contentDetails: { videoId: 'short', videoPublishedAt: '2026-09-08T08:00:00Z' },
    },
  ],
}

check('uploads use the real publish time, not the playlist time', () => {
  const videos = parseUploadsResponse(uploads, { id: RICK, title: 'Rick Astley' })
  const first = videos.find((v) => v.videoId === 'aaaaaaaaaaa')!
  assert.equal(first.publishedAt, Date.parse('2026-09-09T08:00:00Z'))
  assert.notEqual(first.publishedAt, Date.parse('2026-09-10T20:00:00Z'))
})

check('private, deleted and malformed uploads are skipped', () => {
  const ids = parseUploadsResponse(uploads, { id: RICK, title: 'Rick Astley' }).map((v) => v.videoId)
  assert.deepEqual(ids, ['aaaaaaaaaaa', 'ddddddddddd'])
})

check('uploads fall back to the channel title and a derived thumbnail', () => {
  const video = parseUploadsResponse(uploads, { id: RICK, title: 'Rick Astley' }).find(
    (v) => v.videoId === 'ddddddddddd'
  )!
  assert.equal(video.channelTitle, 'Rick Astley')
  assert.equal(video.thumbnail, 'https://i.ytimg.com/vi/ddddddddddd/hqdefault.jpg')
  assert.equal(video.channelId, RICK)
})

check('a stored channel is re-validated, not trusted', () => {
  assert.equal(sanitiseResolvedChannel({ id: 'nope' }), null)
  assert.equal(sanitiseResolvedChannel(null), null)
  const channel = sanitiseResolvedChannel({
    id: RICK,
    title: 'R',
    thumbnail: 'data:x',
    uploadsPlaylistId: '../../etc',
  })
  assert.equal(channel?.thumbnail, null)
  assert.equal(channel?.uploadsPlaylistId, 'UUuAXFkgsw1L7xaCfnd5JJOw')
})

// --- the feed window ---
const FEED_NOW = Date.parse('2026-09-11T12:00:00Z')
const video = (videoId: string, hoursAgo: number) => ({
  videoId,
  title: videoId,
  channelId: RICK,
  channelTitle: 'Rick Astley',
  thumbnail: null,
  publishedAt: FEED_NOW - hoursAgo * HOUR,
})

check('the feed keeps the window, newest first, one entry per video', () => {
  const feed = buildFeed(
    [
      video('bbbbbbbbbbb', 30),
      video('aaaaaaaaaaa', 1),
      video('ccccccccccc', 72),
      video('aaaaaaaaaaa', 1),
      video('ddddddddddd', -2),
    ],
    FEED_NOW,
    2 * DAY
  )
  assert.deepEqual(
    feed.map((v) => v.videoId),
    ['aaaaaaaaaaa', 'bbbbbbbbbbb']
  )
})

check('a video exactly at the window edge is included, one second past is not', () => {
  const edge = buildFeed([{ ...video('aaaaaaaaaaa', 0), publishedAt: FEED_NOW - DAY }], FEED_NOW, DAY)
  const past = buildFeed([{ ...video('aaaaaaaaaaa', 0), publishedAt: FEED_NOW - DAY - 1000 }], FEED_NOW, DAY)
  assert.equal(edge.length, 1)
  assert.equal(past.length, 0)
})

// --- generic merge, used for followed channels ---
const record = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  addedAt: T,
  updatedAt: T,
  deletedAt: null as number | null,
  title: 'x',
  ...over,
})

check('channel merge: newer edit wins and unfollows stick', () => {
  const unfollowed = record('a', { updatedAt: T + 10, deletedAt: T + 10 })
  const stale = record('a', { updatedAt: T })
  assert.equal(mergeRecords([unfollowed], [stale])[0].deletedAt, T + 10)
  assert.equal(mergeRecords([stale], [unfollowed])[0].deletedAt, T + 10)
})

check('channel merge: a true tie resolves the same way on both devices', () => {
  const left = record('a', { title: 'Old name' })
  const right = record('a', { title: 'New name' })
  assert.deepEqual(mergeRecords([left], [right]), mergeRecords([right], [left]))
})

check('channel merge keeps the earliest follow date', () => {
  const merged = mergeRecords([record('a', { addedAt: T + 99, updatedAt: T + 99 })], [record('a')])
  assert.equal(merged[0].addedAt, T)
})

// --- followed-channels store ---
const followable = {
  id: RICK,
  title: 'Rick Astley',
  handle: '@rickastleyyt',
  thumbnail: null,
  uploadsPlaylistId: 'UUuAXFkgsw1L7xaCfnd5JJOw',
}

check('following twice is a no-op', () => {
  assert.ok(addChannel(followable))
  assert.equal(addChannel(followable), null)
  assert.equal(getChannels().filter((c) => c.id === RICK).length, 1)
})

check('unfollowing leaves a stamped tombstone, and following again revives it', () => {
  removeChannel(RICK)
  assert.equal(getChannels().some((c) => c.id === RICK), false)
  const tombstone = getAllChannels().find((c) => c.id === RICK)!
  assert.ok(tombstone.deletedAt)
  assert.equal(tombstone.updatedAt, tombstone.deletedAt)

  const revived = addChannel(followable)
  assert.ok(revived)
  assert.equal(revived.deletedAt, null)
  assert.equal(getAllChannels().filter((c) => c.id === RICK).length, 1)
})

// --- the platform registry ---
const parsed = (input: string) => parseLink(input)!

check('each platform claims its own links and canonicalises them', () => {
  const cases: [string, string, string, string][] = [
    ['https://x.com/jack/status/20', 'x', 'post', 'https://x.com/jack/status/20'],
    ['https://twitter.com/jack/status/20?s=20&t=abc', 'x', 'post', 'https://x.com/jack/status/20'],
    ['https://mobile.twitter.com/jack', 'x', 'profile', 'https://x.com/jack'],
    ['https://www.instagram.com/p/CxYz123/?igshid=1', 'instagram', 'post', 'https://www.instagram.com/p/CxYz123/'],
    ['https://instagram.com/reel/abc123', 'instagram', 'reel', 'https://www.instagram.com/reel/abc123/'],
    ['https://www.instagram.com/nasa/', 'instagram', 'profile', 'https://www.instagram.com/nasa/'],
    ['https://www.facebook.com/watch/?v=123456', 'facebook', 'video', 'https://www.facebook.com/watch/?v=123456'],
    ['https://www.facebook.com/nasa/posts/987', 'facebook', 'post', 'https://www.facebook.com/nasa/posts/987'],
    ['https://www.threads.net/@zuck/post/C8Xy', 'threads', 'post', 'https://www.threads.net/@zuck/post/C8Xy'],
    ['https://www.tiktok.com/@scout2015/video/6718335390845095173', 'tiktok', 'video', 'https://www.tiktok.com/@scout2015/video/6718335390845095173'],
    ['https://www.reddit.com/r/pics/comments/haucpf/a_cat/', 'reddit', 'post', 'https://www.reddit.com/r/pics/comments/haucpf/a_cat/'],
    ['https://old.reddit.com/r/pics/', 'reddit', 'community', 'https://www.reddit.com/r/pics/'],
    ['https://soundcloud.com/forss/flickermood', 'soundcloud', 'track', 'https://soundcloud.com/forss/flickermood'],
    ['https://vimeo.com/22439234', 'vimeo', 'video', 'https://vimeo.com/22439234'],
    ['https://bsky.app/profile/bsky.app/post/3l6o', 'bluesky', 'post', 'https://bsky.app/profile/bsky.app/post/3l6o'],
    ['https://www.twitch.tv/videos/106400740', 'twitch', 'video', 'https://www.twitch.tv/videos/106400740'],
    ['https://example.com/some/article', 'link', 'link', 'https://example.com/some/article'],
  ]
  for (const [input, platform, kind, url] of cases) {
    const link = parsed(input)
    assert.equal(link.platform, platform, input)
    assert.equal(link.kind, kind, input)
    assert.equal(link.url, url, input)
  }
})

// The same post shared from two apps carries different tracking junk; without
// stripping it, one post would become several library items.
check('tracking parameters do not create duplicates', () => {
  assert.equal(
    dedupeKey(parsed('https://example.com/post?utm_source=x&utm_medium=social')),
    dedupeKey(parsed('https://www.example.com/post'))
  )
  assert.equal(
    dedupeKey(parsed('https://www.instagram.com/p/CxYz123/?igshid=zzz')),
    dedupeKey(parsed('https://instagram.com/p/CxYz123/'))
  )
  assert.equal(
    dedupeKey(parsed('https://twitter.com/jack/status/20?s=46')),
    dedupeKey(parsed('https://x.com/jack/status/20'))
  )
})

check('a bare word is still not a link', () => {
  for (const input of ['hello', 'RickAstleyYT', 'just some text', '']) {
    assert.equal(parseLink(input), null, JSON.stringify(input))
  }
})

// Instagram, Facebook, Reddit and unknown sites publish nothing a browser may
// read, so their titles have to come from the URL itself.
check('links with no fetchable metadata still get a readable title', () => {
  const cases: [string, string, string][] = [
    ['https://www.instagram.com/p/CxYz123/', 'Instagram post', 'instagram.com/p/CxYz123'],
    ['https://www.instagram.com/reel/abc123', 'Instagram reel', 'instagram.com/reel/abc123'],
    ['https://www.instagram.com/nasa/', '@nasa', 'instagram.com/nasa'],
    ['https://www.facebook.com/nasa/posts/987', 'Facebook post by nasa', 'facebook.com/nasa/posts/987'],
    // Reddit keeps its subreddit: more use than the URL it came from.
    ['https://www.reddit.com/r/pics/comments/haucpf/a_very_good_cat/', 'A very good cat', 'r/pics'],
    ['https://old.reddit.com/r/pics/', 'r/pics', 'Reddit'],
    ['https://www.threads.net/@zuck/post/C8Xy', 'Post by @zuck', 'threads.net/@zuck/post/C8Xy'],
    // X can be fetched, so its placeholder is only ever shown briefly.
    ['https://x.com/jack/status/20', 'Post by @jack', 'X'],
    ['https://example.com/some/great-article', 'Great article', 'example.com/some/great-article'],
  ]
  for (const [input, title, subtitle] of cases) {
    const meta = placeholderMetadata(parsed(input))
    assert.equal(meta.title, title, input)
    assert.equal(meta.subtitle, subtitle, input)
  }
})

check('metadata is only attempted where an endpoint can actually be read', () => {
  for (const input of [
    'https://x.com/jack/status/20',
    'https://vimeo.com/22439234',
    'https://www.tiktok.com/@a/video/123',
    'https://soundcloud.com/forss/flickermood',
    'https://bsky.app/profile/bsky.app/post/3l6o',
  ]) {
    assert.equal(canFetchMetadata(parsed(input)), true, input)
  }
  for (const input of [
    'https://www.instagram.com/p/CxYz123/',
    'https://www.facebook.com/nasa/posts/987',
    'https://www.reddit.com/r/pics/comments/haucpf/x/',
    'https://example.com/a',
    // A profile has no embeddable post, so there is nothing to ask for.
    'https://x.com/jack',
  ]) {
    assert.equal(canFetchMetadata(parsed(input)), false, input)
  }
})

// X sends no Vary: Origin with a reflected CORS header and a hundred-year
// max-age, so one origin's cached response was replayed to another and refused.
// Scoping the URL per origin gives each its own cache entry.
check('oEmbed requests are scoped to this origin', () => {
  const scope = globalThis as { location?: { origin: string } }
  const saved = scope.location
  scope.location = { origin: 'https://example.test' }
  try {
    const endpoint = oembedEndpoint(parseLink('https://x.com/jack/status/20')!)!
    assert.ok(endpoint.includes('_o=https%3A%2F%2Fexample.test'), endpoint)
    assert.ok(endpoint.includes(encodeURIComponent('https://x.com/jack/status/20')))
  } finally {
    if (saved === undefined) delete scope.location
    else scope.location = saved
  }
})

check('the oEmbed request carries the canonical url', () => {
  const endpoint = oembedEndpoint(parsed('https://twitter.com/jack/status/20?s=46'))!
  assert.ok(endpoint.startsWith('https://publish.x.com/oembed'))
  assert.ok(endpoint.includes(encodeURIComponent('https://x.com/jack/status/20')))
})

// X and Bluesky return an empty title: the post's words are inside the embed
// HTML, so without this a saved post would only ever read "Post by @someone".
check('post text is recovered from embed html', () => {
  const html =
    '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack)</blockquote>'
  assert.equal(textFromEmbedHtml(html), 'just setting up my twttr')
})

check('entities and line breaks survive the unpacking', () => {
  assert.equal(textFromEmbedHtml('<p>a &amp; b<br>c &#39;d&#39; &mdash; e</p>'), "a & b c 'd' — e")
  assert.equal(decodeEntities('&#x1F600; &nbsp;ok'), '😀  ok')
  assert.equal(textFromEmbedHtml(''), '')
})

check('a very long post is truncated rather than filling the card', () => {
  const out = textFromEmbedHtml(`<p>${'x'.repeat(300)}</p>`)
  assert.ok(out.length <= 200)
  assert.ok(out.endsWith('…'))
})

check('stats group by platform in registry order', () => {
  const s = libraryStats([
    statItem({ key: 'a', platform: 'instagram', kind: 'post' }),
    statItem({ key: 'b', platform: 'youtube', kind: 'video' }),
    statItem({ key: 'c', platform: 'link', kind: 'link' }),
    statItem({ key: 'd', platform: 'youtube', kind: 'video' }),
  ])
  assert.deepEqual(
    s.byPlatform.map((p) => [p.label, p.count]),
    [['YouTube', 2], ['Instagram', 1], ['Other', 1]]
  )
  assert.ok(s.byPlatform.every((p) => p.color.startsWith('#')))
})

check('every platform has a filter chip, and posts have their own', () => {
  assert.equal(isFilterId('instagram'), true)
  assert.equal(isFilterId('link'), true)
  assert.equal(isFilterId('posts'), true)
  assert.equal(findFilter('instagram').match(asItem({ platform: 'instagram' })), true)
  assert.equal(findFilter('instagram').match(asItem({ platform: 'youtube' })), false)
  assert.equal(findFilter('posts').match(asItem({ kind: 'reel' })), true)
  assert.equal(findFilter('link').label, 'Other links')
})

// --- renaming ---
//
// The only way to name a link from a platform that publishes nothing readable.
check('renaming keeps your title and protects it from a later lookup', () => {
  const link = parseLink('https://www.facebook.com/watch/?v=999888777')!
  const added = addLink(link)!
  assert.equal(added.title, 'Facebook video')
  assert.equal(added.subtitle, 'facebook.com/watch?v=999888777')

  renameItem(added.key, '  Mum’s birthday video  ')
  const after = getAllItems().find((i) => i.key === added.key)!
  assert.equal(after.title, 'Mum’s birthday video')
  assert.ok(after.updatedAt >= added.updatedAt, 'a rename is an edit, so it is stamped')
  assert.equal(after.resolved, true, 'marked resolved so no lookup replaces it')
})

check('an empty rename is ignored rather than blanking the title', () => {
  const item = getAllItems().find((i) => i.id === '999888777')!
  renameItem(item.key, '   ')
  assert.equal(getAllItems().find((i) => i.key === item.key)!.title, 'Mum’s birthday video')
})

check('a very long title is capped', () => {
  const item = getAllItems().find((i) => i.id === '999888777')!
  renameItem(item.key, 'z'.repeat(500))
  assert.equal(getAllItems().find((i) => i.key === item.key)!.title.length, 200)
})

check('your title beats a fetched one on another device', () => {
  const renamed = entry('rename-key', { updatedAt: T + 500, title: 'My own name', resolved: true })
  const fetched = entry('rename-key', { updatedAt: T, title: 'Fetched name', resolved: true })
  assert.equal(mergeItems([renamed], [fetched])[0].title, 'My own name')
  assert.equal(mergeItems([fetched], [renamed])[0].title, 'My own name')
})

console.log(`${passed} checks passed`)
