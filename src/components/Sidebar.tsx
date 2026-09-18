import { useEffect, useRef, useState, type ComponentType } from 'react'
import { filterFolder, filterTag, type FilterId } from '../lib/filters.ts'
import {
  buildFolderTree,
  isWithinFolder,
  normaliseFolderPath,
  type FolderNode,
} from '../lib/folders.ts'
import { OBJECT_TYPES } from '../lib/objects.ts'
import { setWorkspaceName } from '../lib/preferences.ts'
import type { LibraryItem } from '../lib/store.ts'
import { tagColors, tagCounts } from '../lib/tags.ts'
import type { Section } from '../lib/navigation.ts'
import {
  DataIcon,
  DisclosureIcon,
  FolderIcon,
  LinkIcon,
  PanelIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  TagIcon,
  UserIcon,
} from './Icons'

/** Icons by registry name, so objects.ts can stay free of React. */
const TYPE_ICONS: Record<string, ComponentType> = { link: LinkIcon }

/** Enough tags to navigate by; beyond this the rail becomes a list you scroll
 *  past rather than read, so the rest live on the Tags page. */
const TAG_PREVIEW = 10

type Props = {
  workspace: string
  items: LibraryItem[]
  /** Empty folders: real to you, but carried by no item yet. */
  drafts: string[]
  section: Section
  filterId: FilterId
  /** True while an object page is layered over the section. */
  onObject: boolean
  /** Collapses the rail on desktop; on a phone this closes the drawer instead. */
  onCollapse: () => void
  onSection: (section: Section) => void
  onSelectType: () => void
  onSelectTag: (tag: string) => void
  onSelectFolder: (path: string) => void
  onSelectFilter: (id: FilterId) => void
  onNewFolder: (path: string) => void
  onNew: () => void
  onOpenData: () => void
}

export function Sidebar(props: Props) {
  const { workspace, items, drafts, section, filterId, onObject, onCollapse, onSection } = props
  const { onSelectType, onSelectTag, onSelectFolder, onSelectFilter, onNewFolder } = props
  const { onNew, onOpenData } = props

  const [renaming, setRenaming] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const nameRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) nameRef.current?.select()
  }, [renaming])

  useEffect(() => {
    if (creatingFolder) folderRef.current?.focus()
  }, [creatingFolder])

  const tags = tagCounts(items)
  const shownTags = showAllTags ? tags : tags.slice(0, TAG_PREVIEW)
  const tree = buildFolderTree(items, drafts)
  const unfiled = items.filter((item) => item.folder === null).length

  const activeTag = filterTag(filterId)
  const activeFolder = filterFolder(filterId)
  // A section is only "current" when nothing is layered over it.
  const on = (value: Section) => !onObject && section === value

  // Folders open by default and remember only what you have shut, so a new
  // folder appearing somewhere collapsed is never invisible.
  const isOpen = (path: string) =>
    !collapsed.some((shut) => shut.toLowerCase() === path.toLowerCase())

  const toggle = (path: string) =>
    setCollapsed((current) =>
      isOpen(path)
        ? [...current, path]
        : current.filter((shut) => shut.toLowerCase() !== path.toLowerCase())
    )

  /** Draws a folder and, when it is open, everything under it. */
  const renderFolder = (node: FolderNode) => {
    const open = isOpen(node.path)
    // Gated on the section like every other rail entry: with an object page
    // layered over the list, the rail is not showing where you are, and
    // leaving a folder lit points at the wrong one.
    const current =
      on('type') && activeFolder !== null && node.path.toLowerCase() === activeFolder.toLowerCase()
    // An ancestor of what you are looking at stays lit, so a collapsed branch
    // still says where you are.
    const inside =
      on('type') && !current && activeFolder !== null && isWithinFolder(activeFolder, node.path)

    return (
      <div key={node.path.toLowerCase()} className="folder-branch">
        <div className={`rail-item folder-item ${inside ? 'inside' : ''}`} data-current={current}>
          <button
            className={`disclosure ${open ? 'open' : ''}`}
            onClick={() => toggle(node.path)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            // Kept in the layout when there is nothing to expand, so the names
            // of sibling folders still line up.
            style={{ visibility: node.children.length > 0 ? undefined : 'hidden' }}
          >
            <DisclosureIcon />
          </button>
          <button
            className="folder-open"
            onClick={() => onSelectFolder(node.path)}
            title={`${node.total} in ${node.path}`}
          >
            <FolderIcon />
            <span className="rail-label">{node.name}</span>
          </button>
        </div>
        {open && node.children.length > 0 && (
          <div className="folder-children">{node.children.map(renderFolder)}</div>
        )}
      </div>
    )
  }

  return (
    <nav className="sidebar" aria-label="Workspace">
      <div className="workspace">
        {renaming ? (
          <input
            ref={nameRef}
            className="workspace-input"
            defaultValue={workspace}
            aria-label="Workspace name"
            onBlur={(event) => {
              setWorkspaceName(event.target.value)
              setRenaming(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              // Escape abandons the edit: blur would otherwise save whatever
              // half-typed name is sitting in the field.
              if (event.key === 'Escape') {
                event.currentTarget.value = workspace
                event.currentTarget.blur()
              }
            }}
          />
        ) : (
          <>
            <button
              className="workspace-name"
              onClick={() => onSection('profile')}
              aria-current={on('profile') ? 'page' : undefined}
              title="Your workspace"
            >
              <span className="workspace-mark" aria-hidden="true">
                <SparkIcon />
              </span>
              <span className="workspace-label">{workspace}</span>
            </button>
            <button
              className="rail-icon"
              onClick={() => setRenaming(true)}
              aria-label="Rename this workspace"
              title="Rename"
            >
              <PencilIcon />
            </button>
          </>
        )}

        <button
          className="rail-icon"
          onClick={onCollapse}
          aria-label="Hide the sidebar"
          title="Hide the sidebar"
        >
          <PanelIcon />
        </button>
      </div>

      <div className="rail-group">
        <button className="rail-item accent" onClick={onNew}>
          <PlusIcon />
          <span>New</span>
        </button>
        <button
          className="rail-item"
          onClick={() => onSection('search')}
          aria-current={on('search') ? 'page' : undefined}
        >
          <SearchIcon />
          <span>Search</span>
        </button>
      </div>

      {/* A type owns its folders, so they hang off it rather than sitting in a
          section of their own. With one type that is a small difference; with
          four it is the difference between a rail you can read and a flat list
          of everything you have ever made. */}
      <div className="rail-group">
        <h2 className="rail-heading">Object types</h2>
        {OBJECT_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type.icon] ?? LinkIcon
          return (
            <div key={type.id} className="type-block">
              <div
                className="rail-item type-item"
                data-current={on('type') && !activeTag && !activeFolder && filterId !== 'unfiled'}
              >
                <button className="type-open" onClick={onSelectType} title={`${items.length} saved`}>
                  <span className="type-tile" style={{ color: type.color }}>
                    <Icon />
                  </span>
                  <span className="rail-label">{type.label}</span>
                </button>
                <button
                  className="rail-add"
                  onClick={() => setCreatingFolder(true)}
                  aria-label={`New folder in ${type.label}`}
                  title="New folder"
                >
                  <PlusIcon />
                </button>
              </div>

              <div className="type-children">
                {creatingFolder && (
                  <input
                    ref={folderRef}
                    className="folder-input"
                    placeholder="Work/Research"
                    aria-label="New folder path"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') {
                        event.currentTarget.value = ''
                        event.currentTarget.blur()
                      }
                    }}
                    onBlur={(event) => {
                      const path = normaliseFolderPath(event.target.value)
                      setCreatingFolder(false)
                      if (path) onNewFolder(path)
                    }}
                  />
                )}

                {tree.map(renderFolder)}

                {unfiled > 0 && (
                  <div className="rail-item folder-item" data-current={on('type') && filterId === 'unfiled'}>
                    <span className="disclosure" aria-hidden="true" />
                    <button
                      className="folder-open"
                      onClick={() => onSelectFilter('unfiled')}
                      title={`${unfiled} not filed anywhere`}
                    >
                      <FolderIcon />
                      <span className="rail-label">Unfiled</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tags only earn a section once something is tagged - an empty heading
          would advertise a feature with nothing behind it. */}
      {tags.length > 0 && (
        <div className="rail-group">
          <h2 className="rail-heading">
            <TagIcon />
            <button className="rail-heading-link" onClick={() => onSection('tags')}>
              Tags
            </button>
          </h2>
          {shownTags.map(({ tag, count }) => (
            <button
              key={tag.toLowerCase()}
              className="rail-item"
              onClick={() => onSelectTag(tag)}
              aria-current={
                on('type') && activeTag?.toLowerCase() === tag.toLowerCase() ? 'page' : undefined
              }
              title={`${count} tagged ${tag}`}
            >
              <span className="tag-dot" style={{ background: tagColors(tag).color }} />
              <span className="rail-label">{tag}</span>
              <span className="rail-count">{count}</span>
            </button>
          ))}
          {tags.length > TAG_PREVIEW && (
            <button className="rail-more" onClick={() => setShowAllTags((open) => !open)}>
              {showAllTags ? 'Show fewer' : `Show all ${tags.length}`}
            </button>
          )}
        </div>
      )}

      <div className="rail-group rail-foot">
        <button
          className="rail-item"
          onClick={() => onSection('tags')}
          aria-current={on('tags') ? 'page' : undefined}
        >
          <TagIcon />
          <span>Tags &amp; folders</span>
        </button>
        <button
          className="rail-item"
          onClick={() => onSection('profile')}
          aria-current={on('profile') ? 'page' : undefined}
        >
          <UserIcon />
          <span>Profile &amp; sync</span>
        </button>
        <button className="rail-item" onClick={onOpenData}>
          <DataIcon />
          <span>Export / import</span>
        </button>
      </div>
    </nav>
  )
}
