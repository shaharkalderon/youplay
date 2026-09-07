// Run with: node scripts/test-links.ts  (node strips the types natively)
import assert from 'node:assert/strict'
import { parseLink, dedupeKey } from '../src/lib/links.ts'
import { relativeTime } from '../src/lib/time.ts'
import { sortItems } from '../src/lib/sort.ts'
import { buildExport, exportFilename, parseImport } from '../src/lib/transfer.ts'
import { DEFAULT_FILTER, FILTERS, findFilter, isFilterId } from '../src/lib/filters.ts'
import { mergeItems, pruneTombstones, liveItems, TOMBSTONE_TTL_MS } from '../src/lib/sync.ts'
import { libraryStats } from '../src/lib/stats.ts'
import { isSyncCode, normaliseSyncCode } from '../src/lib/synccode.ts'
import {
  addLink,
  getAllItems,
  removeItem,
  stripTransient,
  toggleWatched,
} from '../src/lib/store.ts'

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

// --- Non-links ---
reject('https://example.com/watch?v=dQw4w9WgXcQ')
reject('https://vimeo.com/12345')
reject('just some text')
reject('')
reject('https://open.spotify.com/track/tooshort')
reject('https://www.youtube.com/watch?v=short')
reject('https://www.youtube.com/@RickAstleyYT')

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
    { url: 'https://vimeo.com/1' },
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
})

check('stats count platforms, kinds and watched state', () => {
  const s = libraryStats([
    statItem({ key: 'a', platform: 'youtube', kind: 'video', watchedAt: 5, addedAt: 100 }),
    statItem({ key: 'b', platform: 'youtube', kind: 'video', watchedAt: null, addedAt: 200 }),
    statItem({ key: 'c', platform: 'spotify', kind: 'album', watchedAt: null, addedAt: 50 }),
    statItem({ key: 'd', platform: 'spotify', kind: 'track', watchedAt: 9, addedAt: 300 }),
  ])
  assert.equal(s.total, 4)
  assert.equal(s.youtube, 2)
  assert.equal(s.spotify, 2)
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

console.log(`${passed} checks passed`)
