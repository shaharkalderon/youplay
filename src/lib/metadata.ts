import type { ParsedLink } from './links.ts'
import { kindLabel } from './links.ts'

export type Metadata = {
  title: string
  subtitle: string
  thumbnail: string | null
}

type OEmbed = {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

/**
 * Both providers expose a public oEmbed endpoint that sends permissive CORS
 * headers, so titles and artwork resolve straight from the browser with no API
 * key, no OAuth and no backend of our own.
 */
function oembedEndpoint(link: ParsedLink): string {
  const target = encodeURIComponent(link.url)
  return link.platform === 'youtube'
    ? `https://www.youtube.com/oembed?url=${target}&format=json`
    : `https://open.spotify.com/oembed?url=${target}`
}

/** YouTube serves predictable thumbnails, which lets us render before oEmbed lands. */
export function fallbackThumbnail(link: ParsedLink): string | null {
  if (link.platform !== 'youtube') return null
  if (link.kind === 'playlist') return null
  return `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`
}

/** A readable placeholder for when the network is down or the link is private. */
export function placeholderMetadata(link: ParsedLink): Metadata {
  return {
    title: `${kindLabel(link.kind)} · ${link.id}`,
    subtitle: link.platform === 'youtube' ? 'YouTube' : 'Spotify',
    thumbnail: fallbackThumbnail(link),
  }
}

export async function fetchMetadata(link: ParsedLink, signal?: AbortSignal): Promise<Metadata> {
  const response = await fetch(oembedEndpoint(link), { signal })
  if (!response.ok) throw new Error(`oEmbed ${response.status}`)
  const data = (await response.json()) as OEmbed

  // Spotify's oEmbed returns no author field, so podcasts and tracks fall back
  // to their content type rather than showing an empty second line.
  const subtitle =
    data.author_name ??
    (link.platform === 'spotify' ? `Spotify · ${kindLabel(link.kind)}` : 'YouTube')

  return {
    title: data.title?.trim() || placeholderMetadata(link).title,
    subtitle,
    thumbnail: data.thumbnail_url ?? fallbackThumbnail(link),
  }
}
