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
