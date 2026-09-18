import { useSyncExternalStore } from 'react'
import { DEFAULT_FILTER, isFilterId, type FilterId } from './filters.ts'
import { isLayout, type Layout } from './layout.ts'
import { isSortOrder, type SortOrder } from './sort.ts'

/**
 * A tiny localStorage-backed preference with a React subscription. Kept here,
 * apart from the pure layout/sort modules, so those stay free of browser and
 * React imports and can be exercised directly by the test script.
 */
function createPreference<T extends string>(
  storageKey: string,
  fallback: T,
  isValid: (value: unknown) => value is T
) {
  const load = (): T => {
    try {
      const stored = localStorage.getItem(storageKey)
      return isValid(stored) ? stored : fallback
    } catch {
      return fallback
    }
  }

  let current = load()
  const listeners = new Set<() => void>()

  const subscribe = (fn: () => void) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  const get = () => current

  const set = (next: T) => {
    if (next === current) return
    current = next
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // A failed write only costs us the preference on next load.
    }
    listeners.forEach((fn) => fn())
  }

  return { get, set, use: () => useSyncExternalStore(subscribe, get, get) }
}

const layout = createPreference<Layout>('youplay.layout.v1', 'grid', isLayout)
export const useLayout = layout.use
export const setLayout = layout.set

const sort = createPreference<SortOrder>('youplay.sort.v1', 'newest', isSortOrder)
export const useSortOrder = sort.use
export const setSortOrder = sort.set

const filter = createPreference<FilterId>('youplay.filter.v1', DEFAULT_FILTER, isFilterId)
export const useFilterId = filter.use
export const setFilterId = filter.set

/**
 * Which tab of an object type's page is showing.
 *
 * `overview` is the type at a glance, `all` is everything in it, and `new` is
 * the type's live inbox — for weblinks, uploads from channels you follow.
 * Opens on `all`, because the queue is what you came back for; the overview is
 * a place you go deliberately.
 */
export type TypeTab = 'overview' | 'all' | 'new'
export const TYPE_TABS: TypeTab[] = ['overview', 'all', 'new']
const isTypeTab = (value: unknown): value is TypeTab => TYPE_TABS.includes(value as TypeTab)
const tab = createPreference<TypeTab>('youplay.tab.v1', 'all', isTypeTab)
export const useTypeTab = tab.use
export const setTypeTab = tab.set

/** Whether the sidebar is showing. Collapsing it is a deliberate choice about
 *  this screen, so it is remembered per device like the layout is. */
export type SidebarState = 'open' | 'collapsed'
const isSidebarState = (value: unknown): value is SidebarState =>
  value === 'open' || value === 'collapsed'
const sidebar = createPreference<SidebarState>('youplay.sidebar.v1', 'open', isSidebarState)
export const useSidebar = sidebar.use
export const setSidebar = sidebar.set

/** How far back the New feed looks, in days. Stored as a string like every preference. */
export type FeedDays = '1' | '2' | '3' | '7'
export const FEED_DAY_OPTIONS: FeedDays[] = ['1', '2', '3', '7']
const isFeedDays = (value: unknown): value is FeedDays =>
  FEED_DAY_OPTIONS.includes(value as FeedDays)
const feedDays = createPreference<FeedDays>('youplay.feedDays.v1', '2', isFeedDays)
export const useFeedDays = feedDays.use
export const setFeedDays = feedDays.set

/**
 * What you call this second brain. It names the workspace in the sidebar and
 * nothing else — the app, its manifest and its install name stay YouPlay, so
 * renaming the workspace can never strand an installed PWA or a share target.
 *
 * Not synced: it is a label on this device's view of the library, and syncing it
 * would mean a rename on a phone silently renaming a laptop's workspace too.
 */
export const DEFAULT_WORKSPACE = 'Second Brain'
const WORKSPACE_LIMIT = 40
// Any non-empty string is valid, so validation is just a type guard; the
// trimming and capping happen on the way in, in `setWorkspaceName`.
const workspace = createPreference<string>(
  'youplay.workspace.v1',
  DEFAULT_WORKSPACE,
  (value): value is string => typeof value === 'string' && value.trim().length > 0
)
export const useWorkspaceName = workspace.use
/** Clearing the name restores the default rather than leaving the sidebar blank. */
export const setWorkspaceName = (name: string) =>
  workspace.set(name.trim().slice(0, WORKSPACE_LIMIT) || DEFAULT_WORKSPACE)
