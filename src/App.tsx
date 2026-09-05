import { useEffect, useMemo, useRef, useState } from 'react'
import { AddDialog } from './components/AddDialog'
import { Card } from './components/Card'
import { DataDialog } from './components/DataDialog'
import { EmptyState } from './components/EmptyState'
import { Profile } from './components/Profile'
import { DataIcon, LogoIcon, PlusIcon, SearchIcon } from './components/Icons'
import { LayoutSwitcher } from './components/LayoutSwitcher'
import { SortControl } from './components/SortControl'
import { DEFAULT_FILTER, FILTERS, findFilter } from './lib/filters.ts'
import { parseLink } from './lib/links.ts'
import { setFilterId, useFilterId, useLayout, useSortOrder } from './lib/preferences.ts'
import { useSync } from './lib/syncsession.ts'
import { sortItems } from './lib/sort.ts'
import { clearShareParams, readSharedLink } from './lib/share.ts'
import {
  addLink,
  getItems,
  removeItem,
  retryUnresolved,
  toggleWatched,
  useLibrary,
} from './lib/store.ts'

type Toast = { message: string; tone: 'ok' | 'error' } | null

export default function App() {
  const items = useLibrary()
  const layout = useLayout()
  const sync = useSync()
  const sortOrder = useSortOrder()
  const [query, setQuery] = useState('')
  const filterId = useFilterId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const consumedShare = useRef(false)

  // Intake from the share target / ?link= hand-off, once per load.
  useEffect(() => {
    if (consumedShare.current) return
    consumedShare.current = true

    // Anything left on placeholder text by an interrupted lookup gets another go.
    retryUnresolved()

    // A remembered filter can go stale — you filtered to Podcasts, then deleted
    // the last one. Landing on an empty screen would read as data loss, so fall
    // back to the default. The default itself is exempt: an empty queue has its
    // own "all caught up" screen, which is a good place to land.
    const current = getItems()
    if (
      filterId !== DEFAULT_FILTER &&
      current.length > 0 &&
      !current.some(findFilter(filterId).match)
    ) {
      setFilterId(DEFAULT_FILTER)
    }

    const shared = readSharedLink(window.location.search)
    if (!shared) return
    clearShareParams()

    if (!shared.link) {
      setToast({ message: 'That share had no YouTube or Spotify link in it.', tone: 'error' })
      return
    }
    const added = addLink(shared.link)
    setToast(
      added
        ? { message: 'Saved to your library', tone: 'ok' }
        : { message: 'Already in your library', tone: 'ok' }
    )
  }, [])

  // Paste anywhere to save. The dialog stays as the discoverable path, but the
  // fast one is Cmd/Ctrl+V straight onto the library.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      // Never hijack a paste the user aimed at a real field.
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      ) {
        return
      }

      const text = event.clipboardData?.getData('text')?.trim()
      if (!text) return

      const link = parseLink(text)
      if (link) {
        event.preventDefault()
        const added = addLink(link)
        setToast(
          added
            ? { message: 'Pasted into your library', tone: 'ok' }
            : { message: 'Already in your library', tone: 'ok' }
        )
        return
      }

      // Only complain when the clipboard plausibly held a link — copying
      // ordinary text and pasting by reflex should stay silent.
      if (/^(https?:\/\/|spotify:)/i.test(text)) {
        setToast({ message: 'Not a YouTube or Spotify link.', tone: 'error' })
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const activeFilter = findFilter(filterId)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = items.filter((item) => {
      if (!activeFilter.match(item)) return false
      if (!needle) return true
      return (
        item.title.toLowerCase().includes(needle) || item.subtitle.toLowerCase().includes(needle)
      )
    })
    return sortItems(matches, sortOrder)
  }, [items, activeFilter, query, sortOrder])

  function handleAdd(raw: string) {
    const link = parseLink(raw)
    if (!link) {
      setToast({ message: 'Not a YouTube or Spotify link.', tone: 'error' })
      return
    }
    const added = addLink(link)
    setDialogOpen(false)
    setToast(
      added
        ? { message: 'Saved to your library', tone: 'ok' }
        : { message: 'Already in your library', tone: 'ok' }
    )
  }

  return (
    <>
      <header className="header">
        <button
          className="brand"
          onClick={() => setShowProfile((open) => !open)}
          aria-expanded={showProfile}
          aria-label={showProfile ? 'Back to your library' : 'Open your profile'}
          title={showProfile ? 'Back to your library' : 'Your profile'}
        >
          <LogoIcon />
          YouPlay
        </button>

        {!showProfile && (
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search your library"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search your library"
          />
        </div>
        )}

        {!showProfile && <LayoutSwitcher value={layout} />}

        <button
          className="icon-button"
          onClick={() => setDataOpen(true)}
          aria-label="Library data: export or import"
          title="Export or import your library"
        >
          <DataIcon />
        </button>

        {/* The label is hidden on narrow screens, so the name has to be explicit. */}
        <button className="add-button" onClick={() => setDialogOpen(true)} aria-label="Add link">
          <PlusIcon />
          <span>Add link</span>
        </button>
      </header>

      {items.length > 0 && !showProfile && (
        <div className="chips-row">
          <nav className="chips" aria-label="Filter library">
            {FILTERS.map((filter) => {
              const count = items.filter(filter.match).length
              // A chip with nothing in it is hidden, unless it is the one
              // currently selected — a vanishing selection is worse than a zero.
              if (count === 0 && filter.id !== 'all' && filter.id !== filterId) return null
              return (
                <button
                  key={filter.id}
                  className="chip"
                  aria-pressed={filter.id === filterId}
                  onClick={() => setFilterId(filter.id)}
                >
                  {filter.label}
                  <span className="count">{count}</span>
                </button>
              )
            })}
          </nav>

          <SortControl value={sortOrder} />
        </div>
      )}

      <main>
        {showProfile ? (
          <Profile items={items} sync={sync} onOpenData={() => setDataOpen(true)} />
        ) : visible.length === 0 ? (
          <EmptyState
            filtered={items.length > 0}
            queueCleared={
              items.length > 0 && filterId === 'unwatched' && query.trim() === ''
            }
            onShowAll={() => setFilterId('all')}
          />
        ) : (
          <div className={`grid layout-${layout}`}>
            {visible.map((item) => (
              <Card
                key={item.key}
                item={item}
                onRemove={removeItem}
                onToggleWatched={toggleWatched}
              />
            ))}
          </div>
        )}
      </main>

      <AddDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleAdd} />

      <DataDialog open={dataOpen} onClose={() => setDataOpen(false)} items={items} />

      {toast && (
        <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  )
}
