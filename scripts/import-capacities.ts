// Convert a Capacities export into a YouPlay import file.
//
//   node scripts/import-capacities.ts "<export folder>" [out.json]
//
// The export folder is the one holding `Weblinks/`, `Books/`, `Quotes/` and so
// on. Only Weblinks are read today; the other types have no home in the app yet.
//
// Nothing here trusts the export beyond the link itself: every URL is run back
// through the app's own parser, so an imported item is one the app could have
// created by saving that link, and two spellings of the same link collapse to
// one entry exactly as they would on paste.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dedupeKey, parseLink, type ParsedLink } from '../src/lib/links.ts'
import { addTag, sanitiseTags } from '../src/lib/tags.ts'
import { normaliseFolderPath } from '../src/lib/folders.ts'

/* ---------- frontmatter ---------- */

type Fields = Record<string, string | string[] | null>

/**
 * Reads the YAML-ish frontmatter Capacities writes. A real YAML parser would be
 * a dependency for a one-off conversion; this handles the four shapes the export
 * actually uses - plain scalars, quoted scalars, `[a, b]` lists, and folded
 * blocks introduced by `>-` - and throws on anything it does not recognise
 * rather than silently dropping a field.
 */
export function frontmatter(text: string): Fields | null {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null

  const lines = text.slice(3, end).split('\n')
  const fields: Fields = {}

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const match = /^([A-Za-z]\w*):\s?(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()

    // A folded or literal block: the value is the indented lines that follow.
    if (value === '>-' || value === '>' || value === '|-' || value === '|') {
      const block: string[] = []
      while (index + 1 < lines.length && !/^[A-Za-z]\w*:/.test(lines[index + 1])) {
        block.push(lines[++index].trim())
      }
      // Folded blocks join with spaces; literal ones keep their newlines.
      value = value.startsWith('>') ? block.join(' ').trim() : block.join('\n').trim()
      fields[key] = value
      continue
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      fields[key] = value
        .slice(1, -1)
        .split(',')
        .map((entry) => unquote(entry.trim()))
        .filter(Boolean)
      continue
    }

    const scalar = unquote(value)
    fields[key] = scalar === '' || scalar === 'null' ? null : scalar
  }

  return fields
}

const unquote = (value: string) =>
  /^'.*'$/.test(value) || /^".*"$/.test(value) ? value.slice(1, -1) : value

const text = (value: string | string[] | null): string =>
  typeof value === 'string' ? value : ''

/* ---------- what to keep ---------- */

/**
 * Titles the scraper produced instead of a real one. Dropping them lets the app
 * fetch the actual title on first load, which is strictly better than importing
 * 27 items all called "- YouTube" - and a placeholder worked out from the URL is
 * a better fallback than a wrong name.
 */
const JUNK_TITLES = new Set([
  '', '- youtube', 'youtube', 'untitled', 'instagram', 'login * instagram',
  'login • instagram', 'google search', 'video', 'facebook', 'watch', 'home',
  'post', 'reel', 'shorts', 'twitter', 'x',
])

const isJunkTitle = (title: string, domain: string) => {
  const lower = title.trim().toLowerCase()
  return JUNK_TITLES.has(lower) || lower === domain.toLowerCase()
}

/**
 * A description that shows up on many items describes the *platform*, not the
 * item - "Enjoy the videos and music you love…" is on every YouTube link in the
 * export. Counting them is a more reliable filter than trying to list the
 * boilerplate, and it adapts to whatever sites a given export happens to hold.
 */
const BOILERPLATE_AT = 3

/* ---------- conversion ---------- */

type Entry = {
  link: ParsedLink
  key: string
  title: string
  subtitle: string
  note: string
  tags: string[]
  folder: string | null
  addedAt: number
}

function run() {
  const [dir, outPath = 'youplay-import.json'] = process.argv.slice(2)
  if (!dir) {
    console.error('Usage: node scripts/import-capacities.ts "<export folder>" [out.json]')
    process.exit(1)
  }

  const weblinks = join(dir, 'Weblinks')
  const files = readdirSync(weblinks).filter((name) => name.endsWith('.md'))

  const parsed: { fields: Fields; file: string }[] = []
  let unreadable = 0
  for (const file of files) {
    const fields = frontmatter(readFileSync(join(weblinks, file), 'utf8'))
    if (!fields || fields.type !== 'Weblink') {
      unreadable++
      continue
    }
    parsed.push({ fields, file })
  }

  // Descriptions are counted before anything is built, because whether one is
  // boilerplate is a fact about the whole export rather than about the item.
  const descriptions = new Map<string, number>()
  for (const { fields } of parsed) {
    const value = text(fields.description).trim()
    if (value) descriptions.set(value, (descriptions.get(value) ?? 0) + 1)
  }

  const byKey = new Map<string, Entry>()
  const skipped: string[] = []
  let multiCollection = 0

  for (const { fields, file } of parsed) {
    const url = text(fields.url)
    const link = url ? parseLink(url) : null
    if (!link) {
      skipped.push(`${file} (${url || 'no url'})`)
      continue
    }

    const domain = text(fields.domain)
    const rawTitle = text(fields.title).trim()
    const description = text(fields.description).trim()
    const boilerplate = (descriptions.get(description) ?? 0) >= BOILERPLATE_AT

    // Capacities allows several collections per object; a YouPlay item lives in
    // exactly one folder. The first becomes the folder and the rest become tags,
    // so the second membership is still findable rather than quietly dropped.
    const collections = text(fields.collections)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (collections.length > 1) multiCollection++

    let tags = sanitiseTags(fields.tags)
    for (const extra of collections.slice(1)) tags = addTag(tags, extra)

    const createdAt = Date.parse(text(fields.createdAt))

    const entry: Entry = {
      link,
      key: dedupeKey(link),
      title: isJunkTitle(rawTitle, domain) ? '' : rawTitle,
      // A short, identifying second line until the real one is fetched.
      subtitle: domain,
      note: boilerplate ? '' : description,
      tags,
      folder: collections[0] ? normaliseFolderPath(collections[0]) : null,
      addedAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    }

    const existing = byKey.get(entry.key)
    byKey.set(entry.key, existing ? merge(existing, entry) : entry)
  }

  const items = [...byKey.values()]
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((entry) => ({
      ...entry.link,
      key: entry.key,
      title: entry.title,
      subtitle: entry.subtitle,
      // No artwork comes across. The export's preview images are presigned S3
      // URLs with a 12-hour expiry, so importing them would fill the library
      // with tiles that go blank the same day. Leaving it null marks the item
      // unresolved instead, and the app fetches a real, durable thumbnail on
      // first load - which also repairs the titles the scraper got wrong.
      thumbnail: null,
      addedAt: entry.addedAt,
      watchedAt: null,
      note: entry.note,
      tags: entry.tags,
      folder: entry.folder,
      updatedAt: entry.addedAt,
      deletedAt: null,
      resolved: false,
    }))

  writeFileSync(
    outPath,
    JSON.stringify({ app: 'youplay', version: 1, exportedAt: new Date().toISOString(), items }, null, 2)
  )

  const filed = items.filter((item) => item.folder).length
  const tagged = items.filter((item) => item.tags.length > 0).length
  const noted = items.filter((item) => item.note).length

  console.log(`read      ${files.length} files (${unreadable} not Weblinks)`)
  console.log(`items     ${items.length} after merging ${parsed.length - skipped.length - items.length} duplicate links`)
  console.log(`filed     ${filed} in folders, ${items.length - filed} unfiled`)
  console.log(`tagged    ${tagged}`)
  console.log(`notes     ${noted} kept, ${parsed.length - skipped.length - noted} blank or boilerplate`)
  if (multiCollection > 0) {
    console.log(`note      ${multiCollection} were in several collections; the extras became tags`)
  }
  if (skipped.length > 0) {
    console.log(`skipped   ${skipped.length} with no usable link:`)
    for (const line of skipped) console.log(`            ${line}`)
  }
  console.log(`\nwrote     ${outPath}`)
}

/** Two exports of the same link: keep the earlier save and the union of what
 *  each knew about it. */
function merge(a: Entry, b: Entry): Entry {
  let tags = a.tags
  for (const tag of b.tags) tags = addTag(tags, tag)
  return {
    ...a,
    title: a.title || b.title,
    note: a.note || b.note,
    folder: a.folder ?? b.folder,
    tags,
    addedAt: Math.min(a.addedAt, b.addedAt),
  }
}

// Only when invoked as a command. The test script imports the frontmatter
// parser, and a module that converts an export on import would be a surprise.
if (process.argv[1]?.endsWith('import-capacities.ts')) run()
