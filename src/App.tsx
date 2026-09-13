import { useEffect, useMemo, useRef, useState } from 'react'
import { AddDialog } from './components/AddDialog'
import { Card } from './components/Card'
import { ChannelDialog } from './components/ChannelDialog'
import { DataDialog } from './components/DataDialog'
import { EmptyState } from './components/EmptyState'
import { FeedView } from './components/FeedView'
import { Profile } from './components/Profile'
import { DataIcon, LogoIcon, PlusIcon, SearchIcon } from './components/Icons'
import { LayoutSwitcher } from './components/LayoutSwitcher'
import { SortControl } from './components/SortControl'
import { useChannels } from './lib/channels.ts'
import { useFeed } from './lib/feed.ts'
import { DEFAULT_FILTER, FILTERS, findFilter } from './lib/filters.ts'
import { parseLink } from './lib/links.ts'
import {
  setFilterId,
  setView,
  useFeedDays,
  useFilterId,
  useLayout,
  useSortOrder,
  useView,
} from './lib/preferences.ts'
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
import { isYouTubeConfigured, looksLikeChannelLink, watchUrl, type FeedVideo } from './lib/youtube.ts'

type Toast = { message: string; tone: 'ok' | 'error' } | null

type ChannelDialogState = { open: boolean; input?: string }

export default function App() {
  const items = useLibrary()
  const channels = useChannels()
  const layout = useLayout()
  const sync = useSync()
  const sortOrder = useSortOrder()
  const view = useView()
  const feedDays = useFeedDays()
  const feed = useFeed(channels, Number(feedDays))
  const [query, setQuery] = useState('')
  const filterId = useFilterId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [channelDialog, setChannelDialog] = useState<ChannelDialogState>({ open: false })
  const [showProfile, setShowProfile] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const consumedShare = useRef(false)

  // The feed is offered once it can do something: a key to fetch with, or
  // channels already followed (synced from a device that has one).
  const feedAvailable = isYouTubeConfigured || channels.length > 0
  // A remembered "feed" view must not strand you on a screen with no way out.
  const onFeed = view === 'feed' && feedAvailable && !showProfile

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

    // Checked before the link itself: now that any URL parses, a channel link
    // would otherwise be saved as an ordinary link instead of followed.
    if (looksLikeChannelLink(shared.raw)) {
      setChannelDialog({ open: true, input: shared.raw })
      return
    }

    if (!shared.link) {
      setToast({ message: 'That share had no link in it.', tone: 'error' })
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

      // A channel link is not something to save — it is something to follow.
      // This has to come first: the generic parser would otherwise claim it.
      if (looksLikeChannelLink(text)) {
        event.preventDefault()
        setChannelDialog({ open: true, input: text })
        return
      }

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
        setToast({ message: 'That does not look like a link.', tone: 'error' })
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
      setToast({ message: 'That does not look like a link.', tone: 'error' })
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

  function handleSaveVideo(video: FeedVideo) {
    const link = parseLink(watchUrl(video.videoId))
    const added = link ? addLink(link) : null
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
              placeholder={onFeed ? 'Search new videos' : 'Search your library'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={onFeed ? 'Search new videos' : 'Search your library'}
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

      {!showProfile && (items.length > 0 || feedAvailable) && (
        <div className="chips-row">
          <nav className="chips" aria-label="Views and filters">
            {feedAvailable && (
              <button
                className="chip chip-new"
                aria-pressed={onFeed}
                onClick={() => setView('feed')}
                title="New uploads from channels you follow"
              >
                New
                <span className="count">{feed.videos.length}</span>
              </button>
            )}

            {items.length > 0 &&
              FILTERS.map((filter) => {
                const count = items.filter(filter.match).length
                // A chip with nothing in it is hidden, unless it is the one
                // currently selected — a vanishing selection is worse than a zero.
                if (count === 0 && filter.id !== 'all' && filter.id !== filterId) return null
                return (
                  <button
                    key={filter.id}
                    className="chip"
                    aria-pressed={!onFeed && filter.id === filterId}
                    onClick={() => {
                      setView('library')
                      setFilterId(filter.id)
                    }}
                  >
                    {filter.label}
                    <span className="count">{count}</span>
                  </button>
                )
              })}
          </nav>

          {/* The feed is always newest first; sorting belongs to the library. */}
          {!onFeed && items.length > 0 && <SortControl value={sortOrder} />}
        </div>
      )}

      <main>
        {showProfile ? (
          <Profile items={items} sync={sync} onOpenData={() => setDataOpen(true)} />
        ) : onFeed ? (
          <FeedView
            channels={channels}
            videos={feed.videos}
            status={feed.status}
            days={feedDays}
            layout={layout}
            query={query}
            library={items}
            onRefresh={() => void feed.refresh()}
            onAddChannel={() => setChannelDialog({ open: true })}
            onSave={handleSaveVideo}
          />
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

      <ChannelDialog
        open={channelDialog.open}
        initialInput={channelDialog.input}
        onClose={() => setChannelDialog({ open: false })}
        onFollowed={(channel) => {
          setToast({ message: `Following ${channel.title}`, tone: 'ok' })
          setView('feed')
        }}
      />

      {toast && (
        <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  )
}
