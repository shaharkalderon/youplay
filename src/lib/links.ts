export type Platform = 'youtube' | 'spotify'

export type Kind =
  | 'video'
  | 'short'
  | 'playlist'
  | 'track'
  | 'album'
  | 'artist'
  | 'show'
  | 'episode'

export type ParsedLink = {
  platform: Platform
  kind: Kind
  id: string
  /** Canonical https URL. This is what we open — see `open.ts` for why. */
  url: string
  /**
   * Native app scheme, where the platform defines one. Part of the link's
   * identity and useful to callers, but deliberately not the open path: an
   * unhandled scheme fails silently with nothing to fall back on.
   */
  appUri: string | null
}

const YT_ID = /^[\w-]{11}$/
const YT_LIST = /^[\w-]{12,}$/
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/

const SPOTIFY_KINDS: Record<string, Kind> = {
  track: 'track',
  album: 'album',
  artist: 'artist',
  playlist: 'playlist',
  show: 'show',
  episode: 'episode',
}

/**
 * Pull the first http(s) or spotify: URL out of arbitrary shared text. Share
 * sheets rarely hand over a bare URL — YouTube sends "Title\nhttps://youtu.be/x"
 * and Spotify appends a tracking blurb after the link.
 */
export function extractUrl(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s<>"']+|spotify:[a-z]+:[A-Za-z0-9]+)/i)
  if (!match) return null
  // Strip trailing punctuation that commonly rides along in shared text.
  return match[0].replace(/[.,;:!?)\]]+$/, '')
}

function parseSpotifyUri(raw: string): ParsedLink | null {
  const parts = raw.split(':')
  if (parts.length < 3) return null
  const kind = SPOTIFY_KINDS[parts[1].toLowerCase()]
  const id = parts[2]
  if (!kind || !SPOTIFY_ID.test(id)) return null
  return {
    platform: 'spotify',
    kind,
    id,
    url: `https://open.spotify.com/${kind}/${id}`,
    appUri: `spotify:${kind}:${id}`,
  }
}

function parseYouTube(u: URL): ParsedLink | null {
  const host = u.hostname.replace(/^www\./, '')
  const segments = u.pathname.split('/').filter(Boolean)

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = segments[0]
    if (id && YT_ID.test(id)) return youtubeVideo(id, 'video')
    return null
  }

  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') {
    return null
  }

  // /watch?v=<id>, /embed/<id>, /live/<id>, /shorts/<id>
  const v = u.searchParams.get('v')
  if (segments[0] === 'watch' && v && YT_ID.test(v)) return youtubeVideo(v, 'video')

  if ((segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') && segments[1]) {
    const id = segments[1]
    if (YT_ID.test(id)) return youtubeVideo(id, segments[0] === 'shorts' ? 'short' : 'video')
  }

  // Playlists, either standalone or riding along on a /watch URL.
  const list = u.searchParams.get('list')
  if ((segments[0] === 'playlist' || !v) && list && YT_LIST.test(list)) {
    return {
      platform: 'youtube',
      kind: 'playlist',
      id: list,
      url: `https://www.youtube.com/playlist?list=${list}`,
      appUri: null,
    }
  }

  return null
}

function youtubeVideo(id: string, kind: Kind): ParsedLink {
  return {
    platform: 'youtube',
    kind,
    id,
    url: kind === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    appUri: `vnd.youtube://${id}`,
  }
}

function parseSpotifyUrl(u: URL): ParsedLink | null {
  if (!/(^|\.)spotify\.com$/.test(u.hostname)) return null
  // Localised links carry an /intl-de/ style prefix ahead of the real segments.
  const segments = u.pathname.split('/').filter(Boolean).filter((s) => !/^intl-\w+$/.test(s))
  const kind = SPOTIFY_KINDS[segments[0]?.toLowerCase()]
  const id = segments[1]
  if (!kind || !id || !SPOTIFY_ID.test(id)) return null
  return {
    platform: 'spotify',
    kind,
    id,
    url: `https://open.spotify.com/${kind}/${id}`,
    appUri: `spotify:${kind}:${id}`,
  }
}

/** Parse any YouTube or Spotify link (or text containing one) into a canonical record. */
export function parseLink(input: string): ParsedLink | null {
  const raw = extractUrl(input.trim()) ?? input.trim()
  if (!raw) return null

  if (raw.toLowerCase().startsWith('spotify:')) return parseSpotifyUri(raw)

  let u: URL
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  return parseYouTube(u) ?? parseSpotifyUrl(u)
}

export const dedupeKey = (link: ParsedLink) => `${link.platform}:${link.kind}:${link.id}`

const KIND_LABEL: Record<Kind, string> = {
  video: 'Video',
  short: 'Short',
  playlist: 'Playlist',
  track: 'Track',
  album: 'Album',
  artist: 'Artist',
  show: 'Podcast',
  episode: 'Episode',
}

export const kindLabel = (kind: Kind) => KIND_LABEL[kind]
