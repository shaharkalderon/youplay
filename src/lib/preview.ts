import type { ParsedLink } from './links.ts'
import { rpc } from './supabase.ts'
import { isSyncConfigured } from './supabase.ts'

/**
 * Titles for links no browser can read.
 *
 * Instagram, Facebook, Reddit and ordinary websites publish no oEmbed endpoint
 * a browser is allowed to call, so the app can otherwise only name them after
 * their URL. Where Supabase is configured, a guarded function there fetches the
 * page and returns just its title and image — see `link_preview` in
 * supabase-setup.sql, which is where the safety rules live.
 *
 * The trade to be aware of: the link you saved is sent to your own Supabase
 * project so it can be fetched from there.
 */

export type Preview = { title: string | null; image: string | null }

type PreviewResponse = {
  ok?: unknown
  title?: unknown
  image?: unknown
  reason?: unknown
}

/** Previews ride on the sync credentials; without them there is nowhere to ask. */
export const isPreviewConfigured = isSyncConfigured

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/**
 * Titles taken from a page often carry the site's name as a suffix
 * ("A very good cat | Reddit"), and Facebook prefixes engagement counts. Both
 * are noise on a card, so they are trimmed here rather than in SQL, where they
 * would be harder to test.
 */
export function tidyTitle(raw: string): string {
  let title = raw.replace(/\s+/g, ' ').trim()

  // "2.8M views · 1.3K reactions | How to share with just friends."
  title = title.replace(/^[\d.,]+[KMB]?\s+views?\s*·?\s*(?:[\d.,]+[KMB]?\s+\w+\s*·?\s*)*\|\s*/i, '')

  // A trailing " | Site" or " - Site", only when what precedes it is substantial.
  const trailing = title.match(/^(.{16,})\s+[|–—-]\s+[^|–—-]{1,30}$/)
  if (trailing) title = trailing[1].trim()

  return title.length > 200 ? `${title.slice(0, 199).trimEnd()}…` : title
}

/**
 * Asks for a preview. Returns null when previews are unavailable or the page
 * gave nothing usable — callers keep their URL-derived title in that case.
 */
export async function fetchPreview(link: ParsedLink): Promise<Preview | null> {
  if (!isPreviewConfigured) return null

  let response: PreviewResponse
  try {
    response = await rpc<PreviewResponse>('link_preview', { p_url: link.url })
  } catch {
    // Not set up yet, refused, or unreachable: the URL-derived title stands.
    return null
  }

  if (response?.ok !== true) return null

  const title = str(response.title)
  const image = str(response.image)
  if (!title && !image) return null

  return {
    title: title ? tidyTitle(title) : null,
    image: image.startsWith('https://') ? image : null,
  }
}
