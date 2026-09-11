import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Channel } from './channels.ts'
import { fetchUploads, isYouTubeConfigured, YouTubeError, type FeedVideo } from './youtube.ts'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Refetch a channel only once its cached uploads are older than this. Each
 * fetch costs one unit of the key's 10,000-a-day quota, so opening the app
 * repeatedly must not refetch every channel every time.
 */
export const STALE_MS = 30 * MINUTE

/** A week of uploads per channel covers the widest window and keeps storage small. */
const KEEP_MS = 7 * DAY
const CACHE_KEY = 'youplay.feed.v1'
const CONCURRENCY = 4

/**
 * The feed itself: uploads inside the window, newest first, one entry per video.
 * Anything dated more than a minute in the future (a scheduled premiere) is
 * not "new" yet and is held back until it goes live.
 */
export function buildFeed(videos: FeedVideo[], now: number, windowMs: number): FeedVideo[] {
  const cutoff = now - windowMs
  const byId = new Map<string, FeedVideo>()
  for (const video of videos) {
    if (video.publishedAt < cutoff || video.publishedAt > now + MINUTE) continue
    if (!byId.has(video.videoId)) byId.set(video.videoId, video)
  }
  return [...byId.values()].sort(
    (a, b) => b.publishedAt - a.publishedAt || a.videoId.localeCompare(b.videoId)
  )
}

type ChannelCache = { fetchedAt: number; videos: FeedVideo[] }
type Cache = Record<string, ChannelCache>

export type FeedStatus = {
  loading: boolean
  lastRefreshedAt: number | null
  /** Per-channel failures, keyed by channel id. */
  errors: Record<string, string>
  /** A failure that affects every channel: bad key, spent quota, API off, offline. */
  fatal: string | null
}

type Snapshot = { cache: Cache; status: FeedStatus }

function loadCache(): Cache {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Cache) : {}
  } catch {
    return {}
  }
}

const initialCache = loadCache()
const lastFetch = Object.values(initialCache).reduce<number | null>(
  (latest, entry) =>
    typeof entry?.fetchedAt === 'number' && (latest === null || entry.fetchedAt > latest)
      ? entry.fetchedAt
      : latest,
  null
)

let snapshot: Snapshot = {
  cache: initialCache,
  status: { loading: false, lastRefreshedAt: lastFetch, errors: {}, fatal: null },
}
const listeners = new Set<() => void>()

function update(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((fn) => fn())
}

function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot.cache))
  } catch {
    // A full or blocked storage only costs the cache: the next load refetches.
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getSnapshot = () => snapshot

let inFlight: Promise<void> | null = null

/**
 * Fetches uploads for every followed channel whose cache is stale, a few at a
 * time. Results are published per channel, so the feed fills in as they land.
 * A fatal error (bad key, spent quota) stops the run: every remaining request
 * would fail identically.
 */
export function refreshFeed(channels: Channel[], force = false): Promise<void> {
  if (!isYouTubeConfigured || channels.length === 0) return Promise.resolve()
  if (inFlight) return inFlight

  const now = Date.now()
  const due = channels.filter((channel) => {
    const cached = snapshot.cache[channel.id]
    return force || !cached || now - cached.fetchedAt > STALE_MS
  })
  if (due.length === 0) return Promise.resolve()

  inFlight = (async () => {
    update({ status: { ...snapshot.status, loading: true, fatal: null } })
    const errors = { ...snapshot.status.errors }
    const outcome: { fatal: string | null } = { fatal: null }
    const queue = [...due]

    async function worker() {
      while (queue.length > 0 && outcome.fatal === null) {
        const channel = queue.shift()!
        try {
          const videos = await fetchUploads(channel)
          const fetchedAt = Date.now()
          delete errors[channel.id]
          update({
            cache: {
              ...snapshot.cache,
              [channel.id]: {
                fetchedAt,
                videos: videos.filter((video) => fetchedAt - video.publishedAt < KEEP_MS),
              },
            },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not load this channel.'
          if (error instanceof YouTubeError && error.fatal) outcome.fatal = message
          else errors[channel.id] = message
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker))

    // Forget channels you no longer follow, so neither the cache nor the error
    // list can grow without bound.
    const live = new Set(channels.map((channel) => channel.id))
    const keep = <V,>(record: Record<string, V>) =>
      Object.fromEntries(Object.entries(record).filter(([id]) => live.has(id)))

    update({
      cache: keep(snapshot.cache),
      status: {
        loading: false,
        lastRefreshedAt: outcome.fatal ? snapshot.status.lastRefreshedAt : Date.now(),
        errors: keep(errors),
        fatal: outcome.fatal,
      },
    })
    persist()
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

/**
 * The New feed for the given channels and window. Refreshes on load, whenever
 * the followed list changes (a new channel has no cache, so this is what fills
 * it in), when the tab regains focus, and every ten minutes — each gated by
 * STALE_MS, so most of those calls cost nothing.
 */
export function useFeed(channels: Channel[], windowDays: number) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [tick, setTick] = useState(0)
  const channelsRef = useRef(channels)
  channelsRef.current = channels

  const ids = channels.map((channel) => channel.id).join(',')

  useEffect(() => {
    void refreshFeed(channelsRef.current)
  }, [ids])

  useEffect(() => {
    const wake = () => {
      if (document.hidden) return
      setTick((n) => n + 1)
      void refreshFeed(channelsRef.current)
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    const timer = window.setInterval(wake, 10 * MINUTE)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.clearInterval(timer)
    }
  }, [])

  const videos = useMemo(() => {
    const all = channels.flatMap((channel) => current.cache[channel.id]?.videos ?? [])
    // Date.now() here rather than a timestamp captured at mount: a video
    // published after the page opened would otherwise look like it is from
    // the future and be held back.
    return buildFeed(all, Date.now(), windowDays * DAY)
    // `tick` is a deliberate dependency: it re-evaluates the window over time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.cache, ids, windowDays, tick])

  return {
    videos,
    status: current.status,
    refresh: () => refreshFeed(channelsRef.current, true),
  }
}
