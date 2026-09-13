import type { ParsedLink } from './links.ts'
import { kindLabel } from './links.ts'
import { platformInfo } from './platforms.ts'

export type Metadata = {
  title: string
  subtitle: string
  thumbnail: string | null
}

type OEmbed = {
  title?: unknown
  author_name?: unknown
  thumbnail_url?: unknown
  html?: unknown
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  '#39': "'",
}

/** Decodes the entities that show up in oEmbed HTML. Kept small and pure so it
 *  runs in the test script as well as the browser. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (whole, code: string) => {
    const key = code.toLowerCase()
    if (ENTITIES[key]) return ENTITIES[key]
    if (key.startsWith('#x')) {
      const value = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole
    }
    if (key.startsWith('#')) {
      const value = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole
    }
    return whole
  })
}

/**
 * X and Bluesky return no `title`: the post's text lives inside the embed HTML,
 * in the first paragraph of a blockquote. Pull it out so a saved post reads as
 * what it says rather than "Post by @someone".
 */
export function textFromEmbedHtml(html: string): string {
  if (!html) return ''
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  const source = paragraph ? paragraph[1] : html
  const text = decodeEntities(
    source
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text
}

/**
 * Gives each origin its own cache entry for the same oEmbed request.
 *
 * X reflects the requesting Origin in its CORS header but sends no
 * `Vary: Origin`, alongside a hundred-year max-age. A browser therefore caches
 * one response — CORS header included — and replays it to a different origin,
 * which is then refused. Seen in production: the deployed site was blocked by
 * an Access-Control-Allow-Origin of http://localhost:5173, cached from a
 * development request minutes earlier.
 *
 * Every endpoint used here ignores the extra parameter and returns the same
 * JSON, so this is applied to all of them rather than special-casing X.
 */
function perOrigin(endpoint: string): string {
  const origin = globalThis.location?.origin
  if (!origin) return endpoint
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}_o=${encodeURIComponent(origin)}`
}

/** The oEmbed endpoint for a link, or null when the platform has none that a
 *  browser may read. */
export function oembedEndpoint(link: ParsedLink): string | null {
  const endpoint = platformInfo(link.platform).oembed?.(link)
  return endpoint ? perOrigin(endpoint) : null
}

/** Whether fetching real metadata is possible at all. Items where it is not
 *  are marked resolved on the spot, so nothing retries them forever. */
export const canFetchMetadata = (link: ParsedLink) => oembedEndpoint(link) !== null

/** Predictable artwork some platforms expose without a lookup. */
export function fallbackThumbnail(link: ParsedLink): string | null {
  return platformInfo(link.platform).thumbnail?.(link) ?? null
}

/**
 * What to show before — or instead of — a metadata lookup. For platforms with
 * no readable oEmbed this is the final text, so it is worked out from the URL
 * rather than left as an opaque id.
 */
export function placeholderMetadata(link: ParsedLink): Metadata {
  const info = platformInfo(link.platform)
  const described = info.describe?.(link)
  return {
    title: described?.title || `${kindLabel(link.kind)} · ${link.id}`,
    subtitle: described?.subtitle || info.label,
    thumbnail: fallbackThumbnail(link),
  }
}

export async function fetchMetadata(link: ParsedLink, signal?: AbortSignal): Promise<Metadata> {
  const endpoint = oembedEndpoint(link)
  if (!endpoint) throw new Error('This platform publishes no readable oEmbed endpoint.')

  const response = await fetch(endpoint, { signal })
  if (!response.ok) throw new Error(`oEmbed ${response.status}`)
  const data = (await response.json()) as OEmbed

  const placeholder = placeholderMetadata(link)
  const info = platformInfo(link.platform)

  return {
    title: str(data.title) || textFromEmbedHtml(str(data.html)) || placeholder.title,
    // Spotify returns no author, so its items fall back to the content type
    // rather than showing an empty second line.
    subtitle:
      str(data.author_name) ||
      (link.platform === 'spotify' ? `Spotify · ${kindLabel(link.kind)}` : info.label),
    thumbnail: str(data.thumbnail_url) || placeholder.thumbnail,
  }
}
