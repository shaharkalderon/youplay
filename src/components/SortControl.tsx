import { setSortOrder } from '../lib/preferences.ts'
import { SORT_LABELS, type SortOrder } from '../lib/sort.ts'
import { SortIcon } from './Icons'

/**
 * One button rather than a menu: there are only two orders, so toggling is
 * faster than opening a picker, and the label always states the current state.
 */
export function SortControl({ value }: { value: SortOrder }) {
  const next: SortOrder = value === 'newest' ? 'oldest' : 'newest'

  return (
    <button
      className="sort-button"
      onClick={() => setSortOrder(next)}
      title={`Sorted by date added — ${SORT_LABELS[value]}. Click for ${SORT_LABELS[next].toLowerCase()}.`}
      aria-label={`Sort by date added: ${SORT_LABELS[value]}. Activate to switch to ${SORT_LABELS[next].toLowerCase()}.`}
    >
      <SortIcon ascending={value === 'oldest'} />
      <span>{SORT_LABELS[value]}</span>
    </button>
  )
}
