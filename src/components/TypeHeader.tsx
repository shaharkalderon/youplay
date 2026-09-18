import type { ObjectType } from '../lib/objects.ts'
import type { Layout } from '../lib/layout.ts'
import { setTypeTab, type TypeTab } from '../lib/preferences.ts'
import type { SortOrder } from '../lib/sort.ts'
import { LayoutSwitcher } from './LayoutSwitcher'
import { SortControl } from './SortControl'
import { LinkIcon, PlusIcon, SearchIcon } from './Icons'

const TAB_LABELS: Record<TypeTab, string> = {
  overview: 'Overview',
  all: 'All',
  new: 'New',
}

type Props = {
  type: ObjectType
  /** How many objects of this type exist, shown beside the tabs. */
  count: number
  tab: TypeTab
  /** Which tabs this type can currently offer — `new` needs a feed to show. */
  tabs: TypeTab[]
  /** Badge on the New tab: how many unseen uploads are waiting. */
  feedCount: number
  query: string
  onQuery: (query: string) => void
  layout: Layout
  sortOrder: SortOrder
  /** Sorting and layout belong to a list; the overview has neither. */
  showListTools: boolean
  onNew: () => void
}

/**
 * The head of an object type's page: what the type is, which of its views you
 * are in, and the controls that act on the whole type.
 *
 * Generic over the registry rather than written for weblinks, so a second type
 * gets this for free.
 */
export function TypeHeader(props: Props) {
  const { type, count, tab, tabs, feedCount, query, onQuery } = props
  const { layout, sortOrder, showListTools, onNew } = props

  return (
    <header className="type-head">
      <div className="type-title-row">
        <span className="type-icon" style={{ color: type.color }} aria-hidden="true">
          <LinkIcon />
        </span>
        <div className="type-title">
          <h1>{type.label}</h1>
          <p>{type.blurb}</p>
        </div>

        <div className="type-search">
          <SearchIcon />
          <input
            type="search"
            placeholder={tab === 'new' ? 'Search new uploads' : `Search ${type.label.toLowerCase()}`}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            aria-label={tab === 'new' ? 'Search new uploads' : `Search ${type.label.toLowerCase()}`}
          />
        </div>

        <button className="add-button" onClick={onNew} aria-label={`Add a ${type.singular}`}>
          <PlusIcon />
          <span>New</span>
        </button>
      </div>

      <div className="type-tabs-row">
        <div className="type-tabs" role="tablist" aria-label={`${type.label} views`}>
          {tabs.map((id) => (
            <button
              key={id}
              role="tab"
              className="type-tab"
              aria-selected={id === tab}
              onClick={() => setTypeTab(id)}
            >
              {TAB_LABELS[id]}
              {id === 'new' && feedCount > 0 && <span className="count">{feedCount}</span>}
            </button>
          ))}
        </div>

        <div className="type-tools">
          <span className="type-count" title={`${count} saved`}>
            {count}
          </span>
          {showListTools && <SortControl value={sortOrder} />}
          {showListTools && <LayoutSwitcher value={layout} />}
        </div>
      </div>
    </header>
  )
}
