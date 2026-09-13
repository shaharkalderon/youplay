import { PLATFORMS, platformInfo, spotifyFromUri } from './platforms.ts'

export type Platform =
  | 'youtube'
  | 'spotify'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'tiktok'
  | 'reddit'
  | 'soundcloud'
  | 'vimeo'
  | 'bluesky'
  | 'twitch'
  | 'linkedin'
  | 'pinterest'
  /** Anything the app has not been taught about; still saved and opened. */
  | 'link'

export type Kind =
  | 'video'
  | 'short'
  | 'playlist'
  | 'track'
  | 'album'
  | 'artist'
  | 'show'
  | 'episode'
  | 'post'
  | 'reel'
  | 'photo'
  | 'profile'
  | 'community'
  | 'link'

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

/**
 * Parse a link, or text containing one, into a canonical record.
 *
 * Each platform gets a look in registry order and the generic handler takes
 * whatever is left, so saving never fails merely because the app has not been
 * taught about a site. Only genuinely unusable input returns null.
 */
export function parseLink(input: string): ParsedLink | null {
  const raw = extractUrl(input.trim()) ?? input.trim()
  if (!raw) return null

  if (raw.toLowerCase().startsWith('spotify:')) return spotifyFromUri(raw)

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  for (const platform of PLATFORMS) {
    const link = platform.parse(url)
    if (link) return link
  }
  return null
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
  post: 'Post',
  reel: 'Reel',
  photo: 'Photo',
  profile: 'Profile',
  community: 'Community',
  link: 'Link',
}

export const kindLabel = (kind: Kind) => KIND_LABEL[kind]

export const platformLabel = (platform: Platform) => platformInfo(platform).label
