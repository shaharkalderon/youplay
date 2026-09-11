import { useSyncExternalStore } from 'react'
import { liveItems, pruneTombstones } from './sync.ts'
import { sanitiseResolvedChannel, type ResolvedChannel } from './youtube.ts'

/**
 * Channels you follow for the New feed. Synced like the library: every change
 * stamps updatedAt, and unfollowing leaves a tombstone so it survives a sync
 * instead of being undone by a device that still has the channel.
 */
export type Channel = ResolvedChannel & {
  key: string
  addedAt: number
  updatedAt: number
  deletedAt: number | null
}

const STORAGE_KEY = 'youplay.channels.v1'

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** Channel lists arrive from storage and from other devices; anything
 *  malformed is dropped rather than trusted. */
export function sanitiseChannels(raw: unknown): Channel[] {
  if (!Array.isArray(raw)) return []
  const channels: Channel[] = []
  for (const entry of raw) {
    const base = sanitiseResolvedChannel(entry)
    if (!base) continue
    const record = entry as Record<string, unknown>
    const addedAt = positive(record.addedAt) ? record.addedAt : Date.now()
    channels.push({
      ...base,
      key: base.id,
      addedAt,
      updatedAt: positive(record.updatedAt) ? record.updatedAt : addedAt,
      deletedAt: positive(record.deletedAt) ? record.deletedAt : null,
    })
  }
  return channels
}

function load(): Channel[] {
  try {
    return pruneTombstones(sanitiseChannels(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')))
  } catch {
    return []
  }
}

let channels: Channel[] = load()
const listeners = new Set<() => void>()

function commit(next: Channel[]) {
  channels = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels))
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let liveCache: Channel[] = liveItems(channels)
let liveSource: Channel[] = channels

/** Followed channels, without tombstones. Memoised for useSyncExternalStore. */
export function getChannels(): Channel[] {
  if (liveSource !== channels) {
    liveSource = channels
    liveCache = liveItems(channels)
  }
  return liveCache
}

export function useChannels(): Channel[] {
  return useSyncExternalStore(subscribe, getChannels, getChannels)
}

/** Everything, tombstones included — for sync only. */
export const getAllChannels = () => channels

export function replaceAllChannels(next: Channel[]) {
  commit(next)
}

export const isFollowing = (channelId: string) =>
  getChannels().some((channel) => channel.id === channelId)

/** Follows a channel. Returns null if it is already followed; a previously
 *  unfollowed channel comes back rather than being refused. */
export function addChannel(resolved: ResolvedChannel): Channel | null {
  const existing = channels.find((channel) => channel.key === resolved.id)
  if (existing && !existing.deletedAt) return null

  const now = Date.now()
  const channel: Channel = { ...resolved, key: resolved.id, addedAt: now, updatedAt: now, deletedAt: null }
  commit([channel, ...channels.filter((entry) => entry.key !== resolved.id)])
  return channel
}

/** Unfollow: a tombstone, so the removal survives a sync. */
export function removeChannel(key: string) {
  const now = Date.now()
  commit(
    channels.map((channel) =>
      channel.key === key ? { ...channel, deletedAt: now, updatedAt: now } : channel
    )
  )
}
