import type { Kind, ParsedLink, Platform } from './links.ts'

/**
 * Everything platform-specific lives here: how a URL is recognised, what its
 * canonical form is, whether its titles can be fetched, and what to call it
 * when they cannot.
 *
 * Metadata is only possible where a platform publishes an oEmbed endpoint that
 * browsers are allowed to read. Verified working: YouTube, Spotify, X, TikTok,
 * Vimeo, SoundCloud, Bluesky. Instagram, Facebook and Threads require a Meta
 * app token; Reddit, Pinterest, Dailymotion, Mixcloud and Flickr answer without
 * CORS headers, so a browser cannot read them; Twitch's endpoint is gone. Those
 * platforms get a title worked out from the URL instead, which is why `describe`
 * exists.
 */
export type PlatformInfo = {
  id: Platform
  label: string
  /** Brand colour for the badge dot, avatar and placeholder tile. */
  color: string
  parse: (url: URL) => ParsedLink | null
  /** A public oEmbed endpoint this browser may read, when one exists. */
  oembed?: (link: ParsedLink) => string | null
  /** Title and subtitle worked out from the URL, for everything else. */
  describe?: (link: ParsedLink) => { title: string; subtitle: string }
  thumbnail?: (link: ParsedLink) => string | null
  /** Square artwork, so the card can letterbox it against a blurred backdrop. */
  squareArt?: boolean
}

/** Parameters that identify a sharer or a campaign rather than the content.
 *  Stripping them means the same link shared twice does not become two items. */
const TRACKING = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'igshid', 'igsh', 'mibextid', 'sfnsn', 'share_id',
  'si', 'ref_src', 'ref_url', '_t', '_r', 'is_from_webapp', 'sender_device',
])

export function stripTracking(url: URL, extra: string[] = []): URL {
  const copy = new URL(url.href)
  for (const key of [...copy.searchParams.keys()]) {
    if (TRACKING.has(key) || extra.includes(key)) copy.searchParams.delete(key)
  }
  return copy
}

const decodeSafe = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const segments = (url: URL) => url.pathname.split('/').filter(Boolean).map(decodeSafe)

/** Host without the interchangeable prefixes, so m./old./mobile. all match. */
export const bareHost = (url: URL) =>
  url.hostname.toLowerCase().replace(/^(www|m|mobile|web|old|np|new)\./, '')

const onHost = (url: URL, ...hosts: string[]) => hosts.includes(bareHost(url))

const prettify = (value: string) =>
  value
    .replace(/\.\w{2,5}$/, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())

const userFromUrl = (url: string, index = 3) => new URL(url).pathname.split('/').filter(Boolean)[index - 3] ?? ''

/**
 * A short, identifying form of the link for the card's second line.
 *
 * Platforms whose metadata a browser may not read would otherwise repeat their
 * own name there ("Facebook" under "Facebook video"), which tells you nothing
 * and makes two saved links indistinguishable. The URL is the only identifying
 * thing left, so it goes there instead.
 */
export function compactUrl(link: ParsedLink): string {
  const url = new URL(link.url)
  const text = `${bareHost(url)}${url.pathname.replace(/\/+$/, '')}${url.search}`
  return text.length > 48 ? `${text.slice(0, 47)}…` : text
}

const YT_ID = /^[\w-]{11}$/
const YT_LIST = /^[\w-]{12,}$/
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/
const DIGITS = /^\d+$/

const SPOTIFY_KINDS: Record<string, Kind> = {
  track: 'track',
  album: 'album',
  artist: 'artist',
  playlist: 'playlist',
  show: 'show',
  episode: 'episode',
}

const oembedUrl = (base: string, link: ParsedLink, extra = '') =>
  `${base}${base.includes('?') ? '&' : '?'}url=${encodeURIComponent(link.url)}${extra}`

function youtubeVideo(id: string, kind: Kind): ParsedLink {
  return {
    platform: 'youtube',
    kind,
    id,
    url: kind === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    appUri: `vnd.youtube://${id}`,
  }
}

function spotifyLink(kind: Kind, id: string): ParsedLink {
  return {
    platform: 'spotify',
    kind,
    id,
    url: `https://open.spotify.com/${kind}/${id}`,
    appUri: `spotify:${kind}:${id}`,
  }
}

/** spotify:track:… URIs, which arrive from the desktop app's share menu. */
export function spotifyFromUri(raw: string): ParsedLink | null {
  const parts = raw.split(':')
  if (parts.length < 3) return null
  const kind = SPOTIFY_KINDS[parts[1].toLowerCase()]
  const id = parts[2]
  if (!kind || !SPOTIFY_ID.test(id)) return null
  return spotifyLink(kind, id)
}

const youtube: PlatformInfo = {
  id: 'youtube',
  label: 'YouTube',
  color: '#ff0033',
  parse: (url) => {
    const host = bareHost(url)
    const parts = segments(url)

    if (host === 'youtu.be') {
      const id = parts[0]
      return id && YT_ID.test(id) ? youtubeVideo(id, 'video') : null
    }
    if (host !== 'youtube.com' && host !== 'music.youtube.com') return null

    const v = url.searchParams.get('v')
    if (parts[0] === 'watch' && v && YT_ID.test(v)) return youtubeVideo(v, 'video')

    if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
      if (YT_ID.test(parts[1])) {
        return youtubeVideo(parts[1], parts[0] === 'shorts' ? 'short' : 'video')
      }
    }

    const list = url.searchParams.get('list')
    if ((parts[0] === 'playlist' || !v) && list && YT_LIST.test(list)) {
      return {
        platform: 'youtube',
        kind: 'playlist',
        id: list,
        url: `https://www.youtube.com/playlist?list=${list}`,
        appUri: null,
      }
    }

    // Channel URLs are deliberately not claimed: they are for following, not
    // saving, and App routes them to the channel dialog before parsing a link.
    return null
  },
  oembed: (link) => oembedUrl('https://www.youtube.com/oembed?format=json', link),
  thumbnail: (link) =>
    link.kind === 'playlist' ? null : `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`,
}

const spotify: PlatformInfo = {
  id: 'spotify',
  label: 'Spotify',
  color: '#1ed760',
  squareArt: true,
  parse: (url) => {
    if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null
    // Localised links carry an /intl-de/ style prefix ahead of the real path.
    const parts = segments(url).filter((part) => !/^intl-\w+$/.test(part))
    const kind = SPOTIFY_KINDS[parts[0]?.toLowerCase()]
    const id = parts[1]
    return kind && id && SPOTIFY_ID.test(id) ? spotifyLink(kind, id) : null
  },
  oembed: (link) => oembedUrl('https://open.spotify.com/oembed', link),
}

const x: PlatformInfo = {
  id: 'x',
  label: 'X',
  color: '#e7e9ea',
  parse: (url) => {
    if (!onHost(url, 'x.com', 'twitter.com')) return null
    const [user, section, id] = segments(url)
    if (!user) return null
    if ((section === 'status' || section === 'statuses') && DIGITS.test(id ?? '')) {
      return { platform: 'x', kind: 'post', id, url: `https://x.com/${user}/status/${id}`, appUri: null }
    }
    if (!section && /^[A-Za-z0-9_]{1,15}$/.test(user)) {
      return {
        platform: 'x',
        kind: 'profile',
        id: user.toLowerCase(),
        url: `https://x.com/${user}`,
        appUri: null,
      }
    }
    return null
  },
  // Verified: publish.x.com answers our origin with CORS and the tweet text.
  oembed: (link) =>
    link.kind === 'post'
      ? oembedUrl('https://publish.x.com/oembed?omit_script=1&dnt=true', link)
      : null,
  describe: (link) => {
    const user = userFromUrl(link.url)
    return link.kind === 'post'
      ? { title: `Post by @${user}`, subtitle: 'X' }
      : { title: `@${user}`, subtitle: 'X' }
  },
}

const instagram: PlatformInfo = {
  id: 'instagram',
  label: 'Instagram',
  color: '#e1306c',
  squareArt: true,
  parse: (url) => {
    if (!onHost(url, 'instagram.com', 'instagr.am', 'ddinstagram.com')) return null
    const [first, second] = segments(url)
    if (!first) return null
    const KINDS: Record<string, Kind> = { p: 'post', reel: 'reel', reels: 'reel', tv: 'video' }
    const kind = KINDS[first]
    if (kind && second) {
      const path = kind === 'reel' ? 'reel' : first === 'tv' ? 'tv' : 'p'
      return {
        platform: 'instagram',
        kind,
        id: second,
        url: `https://www.instagram.com/${path}/${second}/`,
        appUri: null,
      }
    }
    if (first === 'stories' && second) {
      return {
        platform: 'instagram',
        kind: 'post',
        id: segments(url).slice(1).join('-'),
        url: url.href,
        appUri: null,
      }
    }
    if (!second && /^[\w.]{1,30}$/.test(first)) {
      return {
        platform: 'instagram',
        kind: 'profile',
        id: first.toLowerCase(),
        url: `https://www.instagram.com/${first}/`,
        appUri: null,
      }
    }
    return null
  },
  describe: (link) => {
    const noun = link.kind === 'reel' ? 'reel' : link.kind === 'video' ? 'video' : 'post'
    return {
      title: link.kind === 'profile' ? `@${link.id}` : `Instagram ${noun}`,
      subtitle: compactUrl(link),
    }
  },
}

const facebook: PlatformInfo = {
  id: 'facebook',
  label: 'Facebook',
  color: '#1877f2',
  parse: (url) => {
    if (!onHost(url, 'facebook.com', 'fb.com', 'fb.watch', 'fb.me')) return null
    const parts = segments(url)
    const clean = stripTracking(url)

    if (bareHost(url) === 'fb.watch' && parts[0]) {
      return { platform: 'facebook', kind: 'video', id: parts[0], url: clean.href, appUri: null }
    }
    const v = url.searchParams.get('v')
    if (parts[0] === 'watch' && v) {
      return {
        platform: 'facebook',
        kind: 'video',
        id: v,
        url: `https://www.facebook.com/watch/?v=${v}`,
        appUri: null,
      }
    }
    if (parts[0] === 'share' && parts[2]) {
      const kind: Kind = parts[1] === 'v' || parts[1] === 'r' ? 'video' : 'post'
      return { platform: 'facebook', kind, id: parts[2], url: clean.href, appUri: null }
    }
    if (parts[1] === 'posts' && parts[2]) {
      return {
        platform: 'facebook',
        kind: 'post',
        id: parts[2],
        url: `https://www.facebook.com/${parts[0]}/posts/${parts[2]}`,
        appUri: null,
      }
    }
    if (parts[0] === 'groups' && parts[2] === 'posts' && parts[3]) {
      return { platform: 'facebook', kind: 'post', id: parts[3], url: clean.href, appUri: null }
    }
    const fbid = url.searchParams.get('fbid')
    if (fbid) {
      return { platform: 'facebook', kind: 'photo', id: fbid, url: clean.href, appUri: null }
    }
    if (parts.length === 1 && /^[\w.]{1,60}$/.test(parts[0])) {
      return {
        platform: 'facebook',
        kind: 'profile',
        id: parts[0].toLowerCase(),
        url: `https://www.facebook.com/${parts[0]}`,
        appUri: null,
      }
    }
    // Facebook's URL shapes are endless; anything else still belongs to it.
    return parts.length > 0
      ? { platform: 'facebook', kind: 'link', id: `${clean.pathname}${clean.search}`, url: clean.href, appUri: null }
      : null
  },
  describe: (link) => {
    const noun = link.kind === 'video' ? 'video' : link.kind === 'photo' ? 'photo' : 'post'
    const user = new URL(link.url).pathname.split('/').filter(Boolean)[0]
    const named = user && !['watch', 'share', 'groups', 'photo.php', 'photo'].includes(user)
    return {
      title:
        link.kind === 'profile'
          ? link.id
          : named
            ? `Facebook ${noun} by ${user}`
            : `Facebook ${noun}`,
      subtitle: compactUrl(link),
    }
  },
}

const threads: PlatformInfo = {
  id: 'threads',
  label: 'Threads',
  color: '#a0a4a8',
  parse: (url) => {
    if (!onHost(url, 'threads.net', 'threads.com')) return null
    const [handle, section, id] = segments(url)
    if (!handle?.startsWith('@')) return null
    const user = handle.slice(1)
    if (section === 'post' && id) {
      return {
        platform: 'threads',
        kind: 'post',
        id,
        url: `https://www.threads.net/@${user}/post/${id}`,
        appUri: null,
      }
    }
    if (!section) {
      return {
        platform: 'threads',
        kind: 'profile',
        id: user.toLowerCase(),
        url: `https://www.threads.net/@${user}`,
        appUri: null,
      }
    }
    return null
  },
  describe: (link) => {
    const user = new URL(link.url).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '') ?? ''
    return {
      title: link.kind === 'post' ? `Post by @${user}` : `@${user}`,
      subtitle: compactUrl(link),
    }
  },
}

const tiktok: PlatformInfo = {
  id: 'tiktok',
  label: 'TikTok',
  color: '#25f4ee',
  parse: (url) => {
    if (!onHost(url, 'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')) return null
    const parts = segments(url)
    const host = bareHost(url)

    // vm./vt. short links cannot be expanded without a request; keep them whole.
    if ((host === 'vm.tiktok.com' || host === 'vt.tiktok.com') && parts[0]) {
      return {
        platform: 'tiktok',
        kind: 'video',
        id: parts[0],
        url: `https://${host}/${parts[0]}`,
        appUri: null,
      }
    }
    const [handle, section, id] = parts
    if (handle?.startsWith('@') && (section === 'video' || section === 'photo') && id) {
      return {
        platform: 'tiktok',
        kind: section === 'photo' ? 'photo' : 'video',
        id,
        url: `https://www.tiktok.com/${handle}/${section}/${id}`,
        appUri: null,
      }
    }
    if (handle?.startsWith('@') && !section) {
      return {
        platform: 'tiktok',
        kind: 'profile',
        id: handle.slice(1).toLowerCase(),
        url: `https://www.tiktok.com/${handle}`,
        appUri: null,
      }
    }
    return null
  },
  oembed: (link) => (link.kind === 'profile' ? null : oembedUrl('https://www.tiktok.com/oembed', link)),
  describe: (link) => {
    const handle = new URL(link.url).pathname.split('/').filter(Boolean)[0] ?? ''
    return handle.startsWith('@')
      ? { title: link.kind === 'profile' ? handle : `${handle} on TikTok`, subtitle: 'TikTok' }
      : { title: 'TikTok video', subtitle: 'TikTok' }
  },
}

const reddit: PlatformInfo = {
  id: 'reddit',
  label: 'Reddit',
  color: '#ff4500',
  parse: (url) => {
    if (!onHost(url, 'reddit.com', 'redd.it', 'reddit.it')) return null
    const parts = segments(url)

    if (bareHost(url) === 'redd.it' && parts[0]) {
      return { platform: 'reddit', kind: 'post', id: parts[0], url: url.href, appUri: null }
    }
    if (parts[0] === 'r' && parts[2] === 'comments' && parts[3]) {
      return {
        platform: 'reddit',
        kind: 'post',
        id: parts[3],
        url: `https://www.reddit.com/r/${parts[1]}/comments/${parts[3]}/${parts[4] ? `${parts[4]}/` : ''}`,
        appUri: null,
      }
    }
    if (parts[0] === 'r' && parts[1] && !parts[2]) {
      return {
        platform: 'reddit',
        kind: 'community',
        id: parts[1].toLowerCase(),
        url: `https://www.reddit.com/r/${parts[1]}/`,
        appUri: null,
      }
    }
    if ((parts[0] === 'user' || parts[0] === 'u') && parts[1]) {
      return {
        platform: 'reddit',
        kind: 'profile',
        id: parts[1].toLowerCase(),
        url: `https://www.reddit.com/user/${parts[1]}/`,
        appUri: null,
      }
    }
    return null
  },
  // Reddit's oEmbed answers without CORS headers, so the slug is the best title.
  describe: (link) => {
    const parts = new URL(link.url).pathname.split('/').filter(Boolean)
    const sub = parts[0] === 'r' ? `r/${parts[1]}` : 'Reddit'
    if (link.kind === 'community') return { title: `r/${link.id}`, subtitle: 'Reddit' }
    if (link.kind === 'profile') return { title: `u/${link.id}`, subtitle: 'Reddit' }
    const slug = parts[4]
    return { title: slug ? prettify(slug) : `Post in ${sub}`, subtitle: sub }
  },
}

const soundcloud: PlatformInfo = {
  id: 'soundcloud',
  label: 'SoundCloud',
  color: '#ff7700',
  squareArt: true,
  parse: (url) => {
    if (!onHost(url, 'soundcloud.com', 'on.soundcloud.com', 'snd.sc')) return null
    const parts = segments(url)
    if (parts.length === 0) return null
    const clean = stripTracking(url)
    clean.search = ''
    const kind: Kind = parts[1] === 'sets' ? 'playlist' : parts.length === 1 ? 'artist' : 'track'
    return {
      platform: 'soundcloud',
      kind,
      id: parts.join('/').toLowerCase(),
      url: clean.href.replace(/\/$/, ''),
      appUri: null,
    }
  },
  oembed: (link) => oembedUrl('https://soundcloud.com/oembed?format=json', link),
}

const vimeo: PlatformInfo = {
  id: 'vimeo',
  label: 'Vimeo',
  color: '#19b7ea',
  parse: (url) => {
    if (!onHost(url, 'vimeo.com', 'player.vimeo.com')) return null
    const parts = segments(url)
    const id = parts.find((part) => DIGITS.test(part))
    if (!id) return null
    return { platform: 'vimeo', kind: 'video', id, url: `https://vimeo.com/${id}`, appUri: null }
  },
  oembed: (link) => oembedUrl('https://vimeo.com/api/oembed.json', link),
}

const bluesky: PlatformInfo = {
  id: 'bluesky',
  label: 'Bluesky',
  color: '#0085ff',
  parse: (url) => {
    if (!onHost(url, 'bsky.app')) return null
    const [section, handle, kind, rkey] = segments(url)
    if (section !== 'profile' || !handle) return null
    if (kind === 'post' && rkey) {
      return {
        platform: 'bluesky',
        kind: 'post',
        id: `${handle}/${rkey}`,
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        appUri: null,
      }
    }
    return {
      platform: 'bluesky',
      kind: 'profile',
      id: handle.toLowerCase(),
      url: `https://bsky.app/profile/${handle}`,
      appUri: null,
    }
  },
  oembed: (link) => (link.kind === 'post' ? oembedUrl('https://embed.bsky.app/oembed', link) : null),
  describe: (link) => ({
    title: link.kind === 'profile' ? `@${link.id}` : `Post by @${link.id.split('/')[0]}`,
    subtitle: 'Bluesky',
  }),
}

/** Platforms with no readable metadata and simple enough URLs to name. */
function simple(
  id: Platform,
  label: string,
  color: string,
  hosts: string[],
  kindOf: (parts: string[]) => Kind
): PlatformInfo {
  return {
    id,
    label,
    color,
    parse: (url) => {
      if (!onHost(url, ...hosts)) return null
      const parts = segments(url)
      if (parts.length === 0) return null
      const clean = stripTracking(url)
      clean.hash = ''
      return {
        platform: id,
        kind: kindOf(parts),
        id: `${bareHost(clean)}${clean.pathname.replace(/\/+$/, '')}${clean.search}`,
        url: clean.href.replace(/\/$/, ''),
        appUri: null,
      }
    },
    describe: (link) => {
      const parts = new URL(link.url).pathname.split('/').filter(Boolean)
      const last = parts[parts.length - 1] ?? ''
      return {
        title: link.kind === 'profile' ? last : prettify(last) || label,
        subtitle: compactUrl(link),
      }
    },
  }
}

const twitch = simple('twitch', 'Twitch', '#9146ff', ['twitch.tv'], (parts) =>
  parts[0] === 'videos' || parts[1] === 'clip' ? 'video' : 'profile'
)

const linkedin = simple('linkedin', 'LinkedIn', '#0a66c2', ['linkedin.com'], (parts) =>
  parts[0] === 'in' || parts[0] === 'company' ? 'profile' : 'post'
)

const pinterest = simple('pinterest', 'Pinterest', '#e60023', ['pinterest.com', 'pin.it'], (parts) =>
  parts[0] === 'pin' ? 'photo' : 'profile'
)

/**
 * Anything else. Saving a link should never fail just because we have not
 * taught the app about that site; it keeps the URL, the host as its subtitle,
 * and a readable title guessed from the last path segment.
 */
const generic: PlatformInfo = {
  id: 'link',
  label: 'Link',
  color: '#9aa0a6',
  parse: (url) => {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // A hostname with no dot is almost always a mistyped word, not a site.
    if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null
    const clean = stripTracking(url)
    clean.hash = ''
    clean.hostname = clean.hostname.toLowerCase()
    const path = clean.pathname.replace(/\/+$/, '')
    return {
      platform: 'link',
      kind: 'link',
      id: `${bareHost(clean)}${path}${clean.search}`,
      url: clean.href.replace(/\/$/, ''),
      appUri: null,
    }
  },
  describe: (link) => {
    const url = new URL(link.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const host = bareHost(url)
    const last = parts[parts.length - 1]
    return { title: last ? prettify(last) || host : host, subtitle: compactUrl(link) }
  },
}

/** Order matters: the generic catch-all has to come last. */
export const PLATFORMS: PlatformInfo[] = [
  youtube,
  spotify,
  x,
  instagram,
  facebook,
  threads,
  tiktok,
  reddit,
  soundcloud,
  vimeo,
  bluesky,
  twitch,
  linkedin,
  pinterest,
  generic,
]

const BY_ID = new Map(PLATFORMS.map((platform) => [platform.id, platform]))

export const platformInfo = (id: Platform): PlatformInfo => BY_ID.get(id) ?? generic

/** Platform ids in registry order, for stable ordering in stats and filters. */
export const PLATFORM_IDS = PLATFORMS.map((platform) => platform.id)
