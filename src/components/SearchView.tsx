import { useEffect, useRef } from 'react'
import type { Layout } from '../lib/layout.ts'
import { OBJECT_TYPES, countLabel } from '../lib/objects.ts'
import { searchItems } from '../lib/search.ts'
import { sortItems } from '../lib/sort.ts'
import type { LibraryItem } from '../lib/store.ts'
import { tagColors, tagCounts } from '../lib/tags.ts'
import { Card } from './Card'
import { SearchIcon } from './Icons'

type Props = {
  items: LibraryItem[]
  query: string
  layout: Layout
  onQuery: (query: string) => void
  onSelectTag: (tag: string) => void
  onSelectFolder: (path: string) => void
  onRemove: (key: string) => void
  onToggleWatched: (key: string) => void
  onOpen: (key: string) => void
}

/**
 * Search across the whole workspace rather than inside one type.
 *
 * With a single object type it looks much like the list, and that is the point:
 * when notes, books and people arrive, this is already the screen that spans
 * them, so nothing about it has to change.
 */
export function SearchView(props: Props) {
  const { items, query, layout, onQuery, onSelectTag } = props
  // Everything a card needs, forwarded whole rather than named one by one.
  const cardProps = {
    onSelectTag,
    onSelectFolder: props.onSelectFolder,
    onRemove: props.onRemove,
    onToggleWatched: props.onToggleWatched,
    onOpen: props.onOpen,
  }
  const inputRef = useRef<HTMLInputElement>(null)

  // Arriving on this screen means you intend to type; nothing else here is worth
  // focusing first.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = sortItems(searchItems(items, query), 'newest')
  const asked = query.trim().length > 0
  const tags = tagCounts(items).slice(0, 12)

  return (
    <div className="search-view">
      <div className="search-hero">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search titles, notes, tags and links…"
          aria-label="Search your workspace"
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>

      {!asked ? (
        <div className="search-idle">
          <p className="hint">
            Searching {OBJECT_TYPES.map((type) => type.label.toLowerCase()).join(', ')} —{' '}
            {countLabel(OBJECT_TYPES[0], items.length)}. Notes and tags are searched too.
          </p>
          {tags.length > 0 && (
            <>
              <h2 className="rail-heading">Jump to a tag</h2>
              <div className="tag-cloud">
                {tags.map(({ tag, count }) => (
                  <button
                    key={tag.toLowerCase()}
                    className="tag-chip"
                    style={tagColors(tag)}
                    onClick={() => onSelectTag(tag)}
                  >
                    {tag}
                    <span className="tag-count">{count}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : results.length === 0 ? (
        <div className="empty">
          <h2>Nothing matches “{query.trim()}”</h2>
          <p>Titles, notes, tags and link addresses were all searched.</p>
        </div>
      ) : (
        <>
          <p className="result-count" role="status">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </p>
          <div className={`grid layout-${layout}`}>
            {results.map((item) => (
              <Card key={item.key} item={item} {...cardProps} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
