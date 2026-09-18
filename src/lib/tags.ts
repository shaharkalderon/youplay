/**
 * Tags are the cross-cutting index of the second brain: an object can carry any
 * number of them, and a tag is nothing more than the set of objects that use it.
 *
 * They live on the item rather than in a registry of their own. That means a tag
 * exists the moment something uses it and is gone when nothing does — there is
 * no orphan list to garbage-collect, and nothing extra for sync to reconcile.
 */

/** Enough to describe something from several angles, few enough to stay a tag
 *  list rather than a paragraph. */
export const MAX_TAGS_PER_ITEM = 12
const MAX_TAG_LENGTH = 32

/**
 * Cleans a typed tag into its stored form, or null when nothing usable is left.
 *
 * A leading `#` is how people type tags, so it is accepted and dropped. Case is
 * *preserved* — "Israel" should read as a name, not a slug — and every
 * comparison is case-insensitive instead, so typing "stocks" still lands on the
 * existing "Stocks" rather than forking it.
 */
export function normaliseTag(raw: string): string | null {
  const text = raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
  return text || null
}

export const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export const hasTag = (tags: string[], tag: string) =>
  tags.some((existing) => sameTag(existing, tag))

/**
 * Adds a tag to a list. Returns the *same* array when nothing changed — a
 * duplicate, a blank, or a list already at the cap — so callers can skip a
 * pointless write and the sync stamp that would come with it.
 */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normaliseTag(raw)
  if (!tag) return tags
  if (hasTag(tags, tag)) return tags
  if (tags.length >= MAX_TAGS_PER_ITEM) return tags
  return [...tags, tag]
}

export const removeTag = (tags: string[], tag: string): string[] =>
  tags.filter((existing) => !sameTag(existing, tag))

/**
 * Reads a tag list from untrusted input — an import file, or a library written
 * by an older version. Anything that is not a usable tag is dropped rather than
 * failing the whole item.
 */
export function sanitiseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  let tags: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    tags = addTag(tags, entry)
  }
  return tags
}

export type TagCount = { tag: string; count: number }

/**
 * Every tag in use, most-used first, ties broken alphabetically so equal counts
 * do not reorder between renders.
 *
 * Because case is preserved but matching is not, one tag can be spelled several
 * ways. The spelling shown is the most common one — a stray "stocks" typed once
 * must not rename the "Stocks" you have used twenty times.
 */
export function tagCounts(items: { tags: string[] }[]): TagCount[] {
  const groups = new Map<string, Map<string, number>>()

  for (const item of items) {
    for (const tag of item.tags) {
      const bucket = groups.get(tag.toLowerCase()) ?? new Map<string, number>()
      bucket.set(tag, (bucket.get(tag) ?? 0) + 1)
      groups.set(tag.toLowerCase(), bucket)
    }
  }

  return [...groups.values()]
    .map((bucket) => {
      const spellings = [...bucket.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      const count = spellings.reduce((total, [, n]) => total + n, 0)
      return { tag: spellings[0][0], count }
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * A tag's colour, derived from its name so it is the same on every device and
 * every reload without storing anything. Hand-picking colours would be one more
 * thing to sync, and a tag you have not opened yet would have none.
 */
export function tagHue(tag: string): number {
  let hash = 0
  const name = tag.toLowerCase()
  for (let index = 0; index < name.length; index++) {
    // `>>> 0` keeps the running value an unsigned 32-bit int, so the hash is
    // identical on every engine rather than drifting once it overflows.
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash % 360
}

/** Foreground and background for a tag chip, dark-theme tuned. */
export function tagColors(tag: string): { color: string; background: string } {
  const hue = tagHue(tag)
  return { color: `hsl(${hue} 72% 78%)`, background: `hsl(${hue} 38% 20%)` }
}
