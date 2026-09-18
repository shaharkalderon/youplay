import { buildFolderTree, flattenFolders } from '../lib/folders.ts'
import type { LibraryItem } from '../lib/store.ts'
import { tagColors, tagCounts } from '../lib/tags.ts'
import { FolderIcon, TagIcon } from './Icons'

type Props = {
  items: LibraryItem[]
  /** Empty folders, which exist on this device only until something is filed. */
  drafts: string[]
  onSelectTag: (tag: string) => void
  onSelectFolder: (path: string) => void
  onShowUnfiled: () => void
}

/**
 * Everything you have used to organise, in one place.
 *
 * The sidebar shows the ten tags you reach for most; this is the rest of them,
 * and the whole folder tree beside it. Renaming and deleting are deliberately
 * not here: those live on the slice itself, where you can see what you are about
 * to change, rather than in a list where a misclick is invisible.
 */
export function TagsPage({ items, drafts, onSelectTag, onSelectFolder, onShowUnfiled }: Props) {
  const tags = tagCounts(items)
  const folders = flattenFolders(buildFolderTree(items, drafts))
  const unfiled = items.filter((item) => item.folder === null).length

  return (
    <div className="organise">
      <section className="panel">
        <h2>
          <span className="panel-mark">
            <TagIcon />
          </span>
          Tags
          <span className="panel-count">{tags.length}</span>
        </h2>

        {tags.length === 0 ? (
          <p className="hint">
            Nothing is tagged yet. Open any item and add a tag, and it shows up here and in
            the sidebar.
          </p>
        ) : (
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
        )}
      </section>

      <section className="panel">
        <h2>
          <span className="panel-mark">
            <FolderIcon />
          </span>
          Folders
          <span className="panel-count">{folders.length}</span>
        </h2>

        {folders.length === 0 ? (
          <p className="hint">
            No folders yet. Tags say what something is about; a folder says where it lives.
            Make one from the sidebar, or file an item from its own page.
          </p>
        ) : (
          <ul className="folder-list">
            {folders.map((folder) => (
              <li key={folder.path.toLowerCase()} style={{ paddingLeft: (folder.depth - 1) * 18 }}>
                <button className="folder-row" onClick={() => onSelectFolder(folder.path)}>
                  <FolderIcon />
                  <span className="folder-row-name">{folder.name}</span>
                  {/* An empty folder reads as broken unless it says why. */}
                  {folder.total === 0 && <span className="folder-empty">empty</span>}
                  <span className="rail-count">{folder.total || ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {unfiled > 0 && (
          <button className="folder-row unfiled" onClick={onShowUnfiled}>
            <FolderIcon />
            <span className="folder-row-name">Unfiled</span>
            <span className="rail-count">{unfiled}</span>
          </button>
        )}
      </section>
    </div>
  )
}
