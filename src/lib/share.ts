import { parseLink, type ParsedLink } from './links.ts'

export type ShareResult =
  | { status: 'added'; link: ParsedLink }
  | { status: 'duplicate'; link: ParsedLink }
  | { status: 'unrecognised'; raw: string }

/**
 * Reads a link out of the current URL. Covers both intake paths: the PWA share
 * target and a plain hand-off from an iOS Shortcut or a bookmarklet, which is
 * how iPhones get links in since Safari does not implement share targets.
 *
 * The share target names the URL field `link` rather than `url` because Vite's
 * dev server reserves `?url` for its own asset-import handling and answers 403.
 */
export function readSharedLink(search: string): { link: ParsedLink | null; raw: string } | null {
  const params = new URLSearchParams(search)
  // Order matters: `link` is our own clean field, `url` is accepted so a
  // hand-written shortcut using the obvious name still works, `text` is where
  // YouTube and Spotify actually put the link, and `title` is a last resort.
  const raw =
    params.get('link') || params.get('url') || params.get('text') || params.get('title')
  if (!raw) return null
  return { link: parseLink(raw), raw }
}

/** Strip the share parameters so a refresh doesn't re-add the same link. */
export function clearShareParams() {
  const url = new URL(window.location.href)
  let touched = false
  for (const key of ['link', 'url', 'text', 'title']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      touched = true
    }
  }
  if (touched) window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
