import { extractUrl, parseLink } from './links.ts'

/**
 * YouTube Data API v3, called straight from the browser.
 *
 * The API answers cross-origin requests from the site (it returns
 * access-control-allow-origin for the Pages origin), so no proxy is needed.
 * The key ships in the bundle like the Supabase anon key; what stops anyone
 * else spending its quota is restricting it, in Google Cloud, to this site's
 * referrer and to this one API.
 *
 * YouTube's RSS feeds would avoid the key entirely, but they have been
 * returning 404s widely through 2026 and are not a foundation worth building on.
 */

const API = 'https://www.googleapis.com/youtube/v3'

// Optional chaining keeps the pure parsers below importable under plain Node,
// where the test script runs and import.meta.env does not exist.
const apiKey = (import.meta.env?.VITE_YOUTUBE_API_KEY as string | undefined)?.trim() || undefined

export const isYouTubeConfigured = Boolean(apiKey)

const CHANNEL_ID = /^UC[\w-]{22}$/
const VIDEO_ID = /^[\w-]{11}$/
const PLAYLIST_ID = /^[\w-]{12,64}$/
/** Handles are 3-30 characters and can use most scripts, not only ASCII. */
const HANDLE = /^[\p{L}\p{N}._-]{3,30}$/u

export type ChannelRef =
  | { by: 'id'; value: string }
  | { by: 'handle'; value: string }
  | { by: 'username'; value: string }
  | { by: 'video'; value: string }

export type ResolvedChannel = {
  id: string
  title: string
  /** The @handle as YouTube reports it, when the channel has one. */
  handle: string | null
  thumbnail: string | null
  /** Every channel has an "uploads" playlist; reading it costs one quota unit. */
  uploadsPlaylistId: string
}

export type FeedVideo = {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnail: string | null
  /** When the video went public on YouTube, in ms. */
  publishedAt: number
}

export const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Only https images — these URLs come from an API and from other devices, and
 *  end up in an <img src>. */
function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

type Thumbs = Record<string, { url?: unknown } | undefined>

function pickThumb(thumbs: unknown, order: string[]): string | null {
  const available = (thumbs ?? {}) as Thumbs
  for (const size of order) {
    const url = safeHttpsUrl(available[size]?.url)
    if (url) return url
  }
  return null
}

/**
 * Works out which channel a piece of pasted text refers to: an @handle, a
 * channel URL in any of its shapes, a bare channel id, or a link to any video
 * from the channel (its channel is then one lookup away).
 */
export function parseChannelInput(input: string): ChannelRef | null {
  const text = input.trim()
  if (!text) return null

  if (CHANNEL_ID.test(text)) return { by: 'id', value: text }
  if (text.startsWith('@')) {
    const handle = text.slice(1)
    return HANDLE.test(handle) ? { by: 'handle', value: handle } : null
  }

  const raw = extractUrl(text) ?? text
  let url: URL | null = null
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    url = null
  }

  if (url && url.hostname.replace(/^(www|m)\./, '') === 'youtube.com') {
    const [first, second] = url.pathname.split('/').filter(Boolean).map(safeDecode)
    if (first?.startsWith('@')) {
      const handle = first.slice(1)
      if (HANDLE.test(handle)) return { by: 'handle', value: handle }
    }
    if (first === 'channel' && second && CHANNEL_ID.test(second)) return { by: 'id', value: second }
    if (first === 'user' && second) return { by: 'username', value: second }
    // Legacy /c/ custom URLs have no API lookup of their own; most channels'
    // handle now matches the old custom name, so try it as a handle.
    if (first === 'c' && second && HANDLE.test(second)) return { by: 'handle', value: second }
  }

  const link = parseLink(text)
  if (link?.platform === 'youtube' && (link.kind === 'video' || link.kind === 'short')) {
    return { by: 'video', value: link.id }
  }

  // A bare word is most likely a handle typed without its @.
  if (!/[\s/:]/.test(text) && HANDLE.test(text)) return { by: 'handle', value: text }

  return null
}

/**
 * True for text that is plainly a channel rather than a video. Pasting and
 * sharing use it to decide between "save this video" and "follow this channel",
 * so it is deliberately stricter than parseChannelInput: a bare word is not
 * enough here, or copying ordinary text would trigger a channel lookup.
 */
export function looksLikeChannelLink(text: string): boolean {
  const trimmed = text.trim()
  if (/^@[\p{L}\p{N}._-]{3,30}$/u.test(trimmed)) return true
  return /youtube\.com\/(@|channel\/|user\/|c\/)/i.test(trimmed)
}

export class YouTubeError extends Error {
  readonly reason: string
  /** Every request will fail the same way — bad key, spent quota, API off —
   *  so there is no point trying the remaining channels. */
  readonly fatal: boolean

  constructor(message: string, reason: string, fatal = false) {
    super(message)
    this.name = 'YouTubeError'
    this.reason = reason
    this.fatal = fatal
  }
}

type ApiErrorBody = {
  error?: {
    message?: string
    errors?: { reason?: string }[]
    details?: { reason?: string }[]
  }
}

/** Google reports the cause in two places depending on the error's age:
 *  the classic errors[].reason and the newer details[].reason. */
function toYouTubeError(body: unknown, status: number): YouTubeError {
  const error = (body as ApiErrorBody | null)?.error
  const message = error?.message ?? ''
  const reasons = [
    ...(error?.errors ?? []).map((entry) => entry.reason),
    ...(error?.details ?? []).map((entry) => entry.reason),
  ].filter((reason): reason is string => Boolean(reason))
  const has = (...names: string[]) => names.some((name) => reasons.includes(name))

  if (has('quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'RATE_LIMIT_EXCEEDED')) {
    return new YouTubeError(
      "Today's YouTube API quota is used up. It resets at midnight Pacific time.",
      'quotaExceeded',
      true
    )
  }
  if (has('keyInvalid', 'API_KEY_INVALID') || (has('badRequest') && /api key/i.test(message))) {
    return new YouTubeError('The YouTube API key is not valid.', 'keyInvalid', true)
  }
  if (has('accessNotConfigured', 'SERVICE_DISABLED')) {
    return new YouTubeError(
      "YouTube Data API v3 is not enabled for this key's Google Cloud project.",
      'accessNotConfigured',
      true
    )
  }
  if (has('API_KEY_HTTP_REFERRER_BLOCKED', 'ipRefererBlocked') || /referer/i.test(message)) {
    const origin = globalThis.location?.origin ?? 'this site'
    return new YouTubeError(
      `This API key is not allowed on this site. Add ${origin}/* to its website restrictions.`,
      'refererBlocked',
      true
    )
  }
  if (has('playlistNotFound')) {
    return new YouTubeError('This channel has no public uploads.', 'playlistNotFound')
  }
  return new YouTubeError(message || `YouTube answered ${status}.`, reasons[0] ?? String(status))
}

async function api<T>(resource: string, params: Record<string, string>): Promise<T> {
  if (!apiKey) {
    throw new YouTubeError('The channel feed is not set up for this build yet.', 'notConfigured', true)
  }
  const query = new URLSearchParams({ ...params, key: apiKey })

  let response: Response
  try {
    response = await fetch(`${API}/${resource}?${query}`)
  } catch {
    throw new YouTubeError(
      'Could not reach YouTube. Check your connection and try again.',
      'network',
      true
    )
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw toYouTubeError(body, response.status)
  return body as T
}

type ChannelResource = {
  id?: unknown
  snippet?: { title?: unknown; customUrl?: unknown; thumbnails?: unknown }
  contentDetails?: { relatedPlaylists?: { uploads?: unknown } }
}

export function parseChannelResponse(json: unknown): ResolvedChannel | null {
  const item = (json as { items?: ChannelResource[] } | null)?.items?.[0]
  const id = str(item?.id)
  if (!item || !CHANNEL_ID.test(id)) return null

  const uploads = str(item.contentDetails?.relatedPlaylists?.uploads)
  const handle = str(item.snippet?.customUrl)

  return {
    id,
    title: str(item.snippet?.title) || id,
    handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : null,
    thumbnail: pickThumb(item.snippet?.thumbnails, ['medium', 'default', 'high']),
    // The uploads playlist id is the channel id with UC swapped for UU; used
    // only if the API ever omits it.
    uploadsPlaylistId: PLAYLIST_ID.test(uploads) ? uploads : `UU${id.slice(2)}`,
  }
}

/** Re-validates a channel that came from storage or another device, rather
 *  than trusting whatever shape it arrived in. */
export function sanitiseResolvedChannel(raw: unknown): ResolvedChannel | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = str(record.id)
  if (!CHANNEL_ID.test(id)) return null
  const uploads = str(record.uploadsPlaylistId)
  return {
    id,
    title: str(record.title).slice(0, 200) || id,
    handle: str(record.handle).slice(0, 100) || null,
    thumbnail: safeHttpsUrl(record.thumbnail),
    uploadsPlaylistId: PLAYLIST_ID.test(uploads) ? uploads : `UU${id.slice(2)}`,
  }
}

export async function resolveChannel(ref: ChannelRef): Promise<ResolvedChannel> {
  let lookup: Record<string, string>

  if (ref.by === 'video') {
    const video = await api<{ items?: { snippet?: { channelId?: unknown } }[] }>('videos', {
      part: 'snippet',
      id: ref.value,
    })
    const channelId = str(video.items?.[0]?.snippet?.channelId)
    if (!CHANNEL_ID.test(channelId)) {
      throw new YouTubeError('That video is unavailable, so its channel could not be found.', 'notFound')
    }
    lookup = { id: channelId }
  } else if (ref.by === 'id') {
    lookup = { id: ref.value }
  } else if (ref.by === 'handle') {
    lookup = { forHandle: `@${ref.value}` }
  } else {
    lookup = { forUsername: ref.value }
  }

  const json = await api<unknown>('channels', { part: 'snippet,contentDetails', ...lookup })
  const channel = parseChannelResponse(json)
  if (!channel) throw new YouTubeError('No YouTube channel found for that.', 'notFound')
  return channel
}

type PlaylistItemResource = {
  snippet?: {
    title?: unknown
    thumbnails?: unknown
    resourceId?: { videoId?: unknown }
    videoOwnerChannelTitle?: unknown
    videoOwnerChannelId?: unknown
  }
  contentDetails?: { videoId?: unknown; videoPublishedAt?: unknown }
}

/**
 * Turns an uploads-playlist page into feed videos.
 *
 * The publish time comes from contentDetails.videoPublishedAt — when the video
 * went public. snippet.publishedAt is when it was added to the playlist, which
 * for a re-added old video would make it look brand new.
 *
 * Private and deleted videos stay in the playlist as placeholders. The API does
 * not document their exact shape, so rather than trust one field, anything
 * without a real video id and publish time is skipped, as are the placeholder
 * titles when the uploader is missing.
 */
export function parseUploadsResponse(
  json: unknown,
  channel: { id: string; title: string }
): FeedVideo[] {
  const items = (json as { items?: PlaylistItemResource[] } | null)?.items ?? []
  const videos: FeedVideo[] = []

  for (const item of items) {
    const videoId = str(item.contentDetails?.videoId) || str(item.snippet?.resourceId?.videoId)
    const publishedAt = Date.parse(str(item.contentDetails?.videoPublishedAt))
    const title = str(item.snippet?.title)
    const owner = str(item.snippet?.videoOwnerChannelTitle)

    if (!VIDEO_ID.test(videoId) || !Number.isFinite(publishedAt) || !title) continue
    if ((title === 'Private video' || title === 'Deleted video') && !owner) continue

    videos.push({
      videoId,
      title,
      channelId: channel.id,
      channelTitle: owner || channel.title,
      thumbnail:
        pickThumb(item.snippet?.thumbnails, ['high', 'medium', 'standard', 'default']) ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt,
    })
  }

  return videos
}

/**
 * The latest uploads for one channel: one quota unit. 50 is the API maximum
 * per page, which covers even a channel that posts several times a day across
 * the widest window.
 */
export async function fetchUploads(
  channel: { id: string; title: string; uploadsPlaylistId: string }
): Promise<FeedVideo[]> {
  try {
    const json = await api<unknown>('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: channel.uploadsPlaylistId,
      maxResults: '50',
    })
    return parseUploadsResponse(json, channel)
  } catch (error) {
    // A channel that has never uploaded has no uploads playlist yet.
    if (error instanceof YouTubeError && error.reason === 'playlistNotFound') return []
    throw error
  }
}
