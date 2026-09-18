import { useEffect, useMemo, useRef, useState } from 'react'
import { AddDialog } from './components/AddDialog'
import { Card } from './components/Card'
import { ChannelDialog } from './components/ChannelDialog'
import { DataDialog } from './components/DataDialog'
import { EmptyState } from './components/EmptyState'
import { FeedView } from './components/FeedView'
import { Overview } from './components/Overview'
import { Profile } from './components/Profile'
import { SearchView } from './components/SearchView'
import { ContextBar } from './components/ContextBar'
import { ObjectPage } from './components/ObjectPage'
import { Sidebar } from './components/Sidebar'
import { TagsPage } from './components/TagsPage'
import { TypeHeader } from './components/TypeHeader'
import { MenuIcon, SparkIcon } from './components/Icons'
import { useChannels } from './lib/channels.ts'
import { useFeed } from './lib/feed.ts'
import {
  DEFAULT_FILTER,
  FILTERS,
  filterFolder,
  filterTag,
  findFilter,
  folderFilterId,
  tagFilterId,
  type FilterId,
} from './lib/filters.ts'
import { buildFolderTree, flattenFolders } from './lib/folders.ts'
import {
  addDraftFolder,
  removeDraftFolder,
  renameDraftFolder,
  useDraftFolders,
} from './lib/draftfolders.ts'
import { useObjectStack, type Section } from './lib/navigation.ts'
import { parseLink } from './lib/links.ts'
import { DEFAULT_TYPE, objectType } from './lib/objects.ts'
import {
  setFilterId,
  setSidebar,
  setTypeTab,
  useFeedDays,
  useFilterId,
  useLayout,
  useSidebar,
  useSortOrder,
  useTypeTab,
  useWorkspaceName,
  type TypeTab,
} from './lib/preferences.ts'
import { normaliseQuery, matchesQuery } from './lib/search.ts'
import { useSync } from './lib/syncsession.ts'
import { sortItems } from './lib/sort.ts'
import { clearShareParams, readSharedLink } from './lib/share.ts'
import { tagCounts } from './lib/tags.ts'
import {
  addLink,
  deleteFolder,
  deleteTag,
  getItems,
  removeItem,
  renameFolder,
  renameTag,
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
  const workspace = useWorkspaceName()
  const sidebarState = useSidebar()
  const tab = useTypeTab()
  const feedDays = useFeedDays()
  const feed = useFeed(channels, Number(feedDays))
  const [section, setSection] = useState<Section>('type')
  const objects = useObjectStack()
  const drafts = useDraftFolders()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filterId = useFilterId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [channelDialog, setChannelDialog] = useState<ChannelDialogState>({ open: false })
  const [toast, setToast] = useState<Toast>(null)
  const consumedShare = useRef(false)

  const type = objectType(DEFAULT_TYPE)

  // The feed is offered once it can do something: a key to fetch with, or
  // channels already followed (synced from a device that has one).
  const feedAvailable = isYouTubeConfigured || channels.length > 0
  const tabs: TypeTab[] = feedAvailable ? ['overview', 'all', 'new'] : ['overview', 'all']
  // A remembered tab must not strand you on a screen that no longer exists.
  const activeTab: TypeTab = tabs.includes(tab) ? tab : 'all'

  // Intake from the share target / ?link= hand-off, once per load.
  useEffect(() => {
    if (consumedShare.current) return
    consumedShare.current = true

    // Anything left on placeholder text by an interrupted lookup gets another go.
    retryUnresolved()

    // A remembered filter can go stale — you filtered to a tag, then removed it
    // from the last item carrying it. Landing on an empty screen would read as
    // data loss, so fall back to the default. The default itself is exempt: an
    // empty queue has its own "all caught up" screen, a good place to land.
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
  // fast one is Cmd/Ctrl+V straight onto the workspace.
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
  const activeTag = filterTag(filterId)
  const activeFolder = filterFolder(filterId)
  const openObject = objects.openKey
    ? items.find((item) => item.key === objects.openKey)
    : undefined

  const visible = useMemo(() => {
    const needle = normaliseQuery(query)
    const matches = items.filter(
      (item) => activeFilter.match(item) && matchesQuery(item, needle)
    )
    return sortItems(matches, sortOrder)
  }, [items, activeFilter, query, sortOrder])

  /** Every tag in use, for the edit sheet's suggestions. */
  const knownTags = useMemo(() => tagCounts(items).map((entry) => entry.tag), [items])

  /** Every folder that exists, in tree order, for the folder pickers. */
  const folderPaths = useMemo(
    () => flattenFolders(buildFolderTree(items, drafts)).map((node) => node.path),
    [items, drafts]
  )

  /**
   * An object whose item has gone — deleted here, or removed on another device
   * and pulled in by a sync — cannot stay on screen showing nothing. It closes
   * through the same gesture as Back, so history stays in step.
   */
  useEffect(() => {
    if (objects.openKey && !openObject) objects.close()
  }, [objects.openKey, openObject])

  /** Navigating always lands you on the list, because a tag or a folder is a
   *  slice of it — the overview would hide what you just asked for. */
  function showFilter(id: FilterId) {
    setSection('type')
    setTypeTab('all')
    setFilterId(id)
    setDrawerOpen(false)
    // Any object page was layered over wherever you were; going somewhere new
    // means leaving it rather than hiding it behind the list.
    objects.closeAll()
  }

  function goToSection(next: Section) {
    setSection(next)
    setDrawerOpen(false)
    objects.closeAll()
  }

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

  const showTag = (tag: string) => showFilter(tagFilterId(tag))
  const showFolder = (path: string) => showFilter(folderFilterId(path))

  const cardProps = {
    onRemove: removeItem,
    onToggleWatched: toggleWatched,
    onSelectTag: showTag,
    onSelectFolder: showFolder,
    onOpen: objects.open,
  }

  /**
   * Renaming a folder has to move the empty ones too. They live outside the
   * library — nothing carries them — so the store's rename cannot see them.
   */
  function handleRenameFolder(from: string, to: string) {
    // The stored path is not the typed one - `/Work/` is stored as `Work` - so
    // the filter follows what the store kept. Following the raw text instead
    // lands on a folder nothing is in, which reads as having lost the contents.
    const path = renameFolder(from, to)
    if (!path) return
    renameDraftFolder(from, path)
    showFolder(path)
    setToast({ message: 'Folder renamed', tone: 'ok' })
  }

  function handleDeleteFolder(path: string) {
    deleteFolder(path)
    removeDraftFolder(path)
    showFilter(DEFAULT_FILTER)
    setToast({ message: 'Folder deleted, nothing was thrown away', tone: 'ok' })
  }

  return (
    <div className="shell" data-sidebar={sidebarState} data-drawer={drawerOpen ? 'open' : 'closed'}>
      <Sidebar
        workspace={workspace}
        items={items}
        drafts={drafts}
        section={section}
        filterId={filterId}
        onObject={openObject !== undefined}
        onCollapse={() => {
          setSidebar('collapsed')
          setDrawerOpen(false)
        }}
        onSection={goToSection}
        onSelectType={() => showFilter(DEFAULT_FILTER)}
        onSelectTag={showTag}
        onSelectFolder={showFolder}
        onSelectFilter={showFilter}
        onNewFolder={(path) => {
          // The folder exists here the moment you name it; it becomes real for
          // every device as soon as something is filed in it.
          const created = addDraftFolder(path)
          if (created) showFolder(created)
        }}
        onNew={() => {
          setDialogOpen(true)
          setDrawerOpen(false)
        }}
        onOpenData={() => {
          setDataOpen(true)
          setDrawerOpen(false)
        }}
      />

      {/* Closes the drawer by tapping away from it. Inert on desktop, where the
          sidebar is part of the layout rather than something laid over it. */}
      <button
        className="scrim"
        tabIndex={drawerOpen ? 0 : -1}
        aria-hidden={!drawerOpen}
        aria-label="Close the sidebar"
        onClick={() => setDrawerOpen(false)}
      />

      <div className="content">
        {/* Shown on a phone, and on desktop once the sidebar is hidden — it is
            the only way back to it. */}
        <div className="topbar">
          <button
            className="icon-button"
            onClick={() => {
              setSidebar('open')
              setDrawerOpen(true)
            }}
            aria-label="Show the sidebar"
            title="Show the sidebar"
          >
            <MenuIcon />
          </button>
          <span className="topbar-name">
            <SparkIcon />
            {workspace}
          </span>
        </div>

        <main>
          {openObject ? (
            <ObjectPage
              /* Keyed on the item so the page's draft title and note can never
                 belong to a different object than the one on screen. */
              key={openObject.key}
              item={openObject}
              items={items}
              folders={folderPaths}
              tagSuggestions={knownTags}
              onBack={objects.close}
              onOpenObject={objects.open}
              onSelectTag={showTag}
              onSelectFolder={showFolder}
              onToggleWatched={toggleWatched}
              onRemove={removeItem}
            />
          ) : section === 'profile' ? (
            <Profile items={items} sync={sync} onOpenData={() => setDataOpen(true)} />
          ) : section === 'tags' ? (
            <TagsPage
              items={items}
              drafts={drafts}
              onSelectTag={showTag}
              onSelectFolder={showFolder}
              onShowUnfiled={() => showFilter('unfiled')}
            />
          ) : section === 'search' ? (
            <SearchView
              items={items}
              query={query}
              layout={layout}
              onQuery={setQuery}
              {...cardProps}
            />
          ) : (
            <>
              <TypeHeader
                type={type}
                count={items.length}
                tab={activeTab}
                tabs={tabs}
                feedCount={feed.videos.length}
                query={query}
                onQuery={setQuery}
                layout={layout}
                sortOrder={sortOrder}
                showListTools={activeTab !== 'overview'}
                onNew={() => setDialogOpen(true)}
              />

              {activeTab === 'overview' ? (
                <Overview
                  items={items}
                  onSelectTag={(tag) => showFilter(tagFilterId(tag))}
                  onShowAll={() => showFilter('all')}
                  onShowQueue={() => showFilter('unwatched')}
                />
              ) : activeTab === 'new' ? (
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
              ) : (
                <>
                  {/* A slice reached from the sidebar names itself here, where
                      you can also rename or delete it while looking at exactly
                      what that would change. */}
                  {activeTag && (
                    <ContextBar
                      kind="tag"
                      value={activeTag}
                      count={items.filter(activeFilter.match).length}
                      onRename={(next) => {
                        // Same as folders: follow the stored name, not the typed
                        // one, or the filter points at a tag nobody carries.
                        const tag = renameTag(activeTag, next)
                        if (!tag) return
                        showTag(tag)
                        setToast({ message: 'Tag renamed', tone: 'ok' })
                      }}
                      onDelete={() => {
                        deleteTag(activeTag)
                        showFilter(DEFAULT_FILTER)
                        setToast({ message: 'Tag removed from every item', tone: 'ok' })
                      }}
                      onClear={() => setFilterId('all')}
                    />
                  )}

                  {activeFolder && (
                    <ContextBar
                      kind="folder"
                      value={activeFolder}
                      count={items.filter(activeFilter.match).length}
                      onRename={(next) => handleRenameFolder(activeFolder, next)}
                      onDelete={() => handleDeleteFolder(activeFolder)}
                      onClear={() => setFilterId('all')}
                    />
                  )}

                  {items.length > 0 && (
                    <nav className="chips" aria-label="Filters">
                      {FILTERS.map((filter) => {
                        const count = items.filter(filter.match).length
                        // A chip with nothing in it is hidden, unless it is the
                        // one selected — a vanishing selection is worse than a zero.
                        if (count === 0 && filter.id !== 'all' && filter.id !== filterId) {
                          return null
                        }
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
                  )}

                  {visible.length === 0 ? (
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
                        <Card {...cardProps} key={item.key} item={item} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <AddDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleAdd} />

      <DataDialog open={dataOpen} onClose={() => setDataOpen(false)} items={items} />

      <ChannelDialog
        open={channelDialog.open}
        initialInput={channelDialog.input}
        onClose={() => setChannelDialog({ open: false })}
        onFollowed={(channel) => {
          setToast({ message: `Following ${channel.title}`, tone: 'ok' })
          setSection('type')
          setTypeTab('new')
        }}
      />

      {toast && (
        <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
