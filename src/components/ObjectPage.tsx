import { useEffect, useState } from 'react'
import { folderName, parentFolder } from '../lib/folders.ts'
import { kindLabel } from '../lib/links.ts'
import { openItem } from '../lib/open.ts'
import { platformInfo } from '../lib/platforms.ts'
import { editItem, NOTE_LIMIT, setFolder, type LibraryItem } from '../lib/store.ts'
import { hasTag, tagColors } from '../lib/tags.ts'
import { absoluteTime, relativeTime } from '../lib/time.ts'
import { FolderPicker } from './FolderPicker'
import { TagEditor } from './TagEditor'
import {
  BackIcon,
  CheckIcon,
  ExternalIcon,
  FolderIcon,
  TrashIcon,
  UndoIcon,
} from './Icons'

type Props = {
  item: LibraryItem
  /** The whole library, for the related strip and the tag suggestions. */
  items: LibraryItem[]
  /** Every folder that exists, in tree order. */
  folders: string[]
  tagSuggestions: string[]
  onBack: () => void
  onOpenObject: (key: string) => void
  onSelectTag: (tag: string) => void
  onSelectFolder: (path: string) => void
  onToggleWatched: (key: string) => void
  onRemove: (key: string) => void
}

/** Few enough to glance at; more than that and it competes with the list. */
const RELATED = 6

/**
 * One object, on its own page.
 *
 * This is where a saved link stops being a bookmark. The fetched title and
 * artwork are the smaller half of it; the note, the tags and the folder are
 * yours, and they are what make the thing findable a year later.
 *
 * Every field saves as you leave it rather than behind a Save button. There is
 * nothing to submit here, so a button would only invent a way to lose work by
 * navigating away. Mounting is keyed on the item, so the draft state below can
 * never belong to a different object than the one on screen.
 */
export function ObjectPage(props: Props) {
  const { item, items, folders, tagSuggestions, onBack, onOpenObject } = props
  const { onSelectTag, onSelectFolder, onToggleWatched, onRemove } = props

  const [title, setTitle] = useState(item.title)
  const [note, setNote] = useState(item.note)

  // A lookup that lands while the page is open should fill the title in, but
  // only if you have not started typing over it.
  useEffect(() => {
    setTitle((current) => (current === '' ? item.title : current))
  }, [item.title])

  const platform = platformInfo(item.platform)
  const watched = item.watchedAt !== null
  const squareArt = Boolean(platform.squareArt)

  const related = items
    .filter(
      (other) =>
        other.key !== item.key &&
        (item.tags.some((tag) => hasTag(other.tags, tag)) ||
          (item.folder !== null && other.folder === item.folder))
    )
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, RELATED)

  const commitTitle = () => {
    // An empty field means "leave the title alone", not "call this nothing",
    // so the input is put back rather than the item renamed.
    if (!title.trim()) {
      setTitle(item.title)
      return
    }
    editItem(item.key, { title })
  }

  return (
    <article className="object-page">
      <div className="object-bar">
        <button className="btn ghost" onClick={onBack}>
          <BackIcon />
          Back
        </button>

        <nav className="crumbs" aria-label="Where this is filed">
          {item.folder ? (
            <>
              {parentFolder(item.folder) && (
                <button
                  className="crumb"
                  onClick={() => onSelectFolder(parentFolder(item.folder as string) as string)}
                >
                  {folderName(parentFolder(item.folder) as string)}
                </button>
              )}
              <button className="crumb" onClick={() => onSelectFolder(item.folder as string)}>
                <FolderIcon />
                {folderName(item.folder)}
              </button>
            </>
          ) : (
            <span className="crumb muted">Unfiled</span>
          )}
        </nav>

        <div className="object-bar-tools">
          <button
            className={`btn ghost ${watched ? 'is-watched' : ''}`}
            onClick={() => onToggleWatched(item.key)}
            aria-pressed={watched}
          >
            {watched ? <UndoIcon /> : <CheckIcon />}
            {watched ? 'Back to the queue' : 'Mark watched'}
          </button>
          <button
            className="btn ghost danger"
            onClick={() => {
              onRemove(item.key)
              onBack()
            }}
            aria-label={`Remove "${item.title}"`}
            title="Remove from your library"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <header className="object-head">
        <button
          className={`object-art ${squareArt ? 'square' : ''} ${item.thumbnail ? '' : 'blank'}`}
          onClick={() => openItem(item)}
          aria-label={`Open "${item.title}" in ${platform.label}`}
        >
          {item.thumbnail && squareArt && (
            <img className="backdrop" src={item.thumbnail} alt="" aria-hidden="true" />
          )}
          {item.thumbnail ? (
            <img className="art" src={item.thumbnail} alt="" />
          ) : (
            <span className="blank-mark" style={{ color: platform.color }} aria-hidden="true">
              {platform.label.charAt(0)}
            </span>
          )}
        </button>

        <div className="object-title">
          <input
            className="title-input"
            value={title}
            aria-label="Title"
            placeholder="Name this"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setTitle(item.title)
                event.currentTarget.blur()
              }
            }}
          />

          <p className="object-meta">
            <span className="dot" style={{ background: platform.color }} />
            {platform.label}
            <span className="sep">/</span>
            {kindLabel(item.kind)}
            {item.subtitle && (
              <>
                <span className="sep">/</span>
                {item.subtitle}
              </>
            )}
          </p>

          <p className="object-meta muted">
            <span title={absoluteTime(item.addedAt)}>Added {relativeTime(item.addedAt)}</span>
            {watched && (
              <>
                <span className="sep">/</span>
                <span title={absoluteTime(item.watchedAt as number)}>
                  Watched {relativeTime(item.watchedAt as number)}
                </span>
              </>
            )}
          </p>

          <div className="object-actions">
            <button className="btn primary" onClick={() => openItem(item)}>
              <ExternalIcon />
              Open in {platform.label}
            </button>
            <a className="object-url" href={item.url} target="_blank" rel="noopener noreferrer">
              {item.url}
            </a>
          </div>
        </div>
      </header>

      <section className="object-field">
        <h2>Note</h2>
        <textarea
          className="note-input large"
          value={note}
          rows={6}
          maxLength={NOTE_LIMIT}
          placeholder="Why you saved this, what to do with it, what it turned out to be worth."
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => editItem(item.key, { note })}
        />
      </section>

      <div className="object-columns">
        <section className="object-field">
          <h2>Tags</h2>
          <TagEditor
            tags={item.tags}
            suggestions={tagSuggestions}
            onChange={(tags) => editItem(item.key, { tags })}
          />
        </section>

        <section className="object-field">
          <h2>Folder</h2>
          <FolderPicker
            value={item.folder}
            folders={folders}
            onChange={(path) => setFolder(item.key, path)}
          />
        </section>
      </div>

      {related.length > 0 && (
        <section className="object-field">
          <h2>Related</h2>
          <p className="hint">Sharing a tag or a folder with this one.</p>
          <ul className="related">
            {related.map((other) => {
              const info = platformInfo(other.platform)
              return (
                <li key={other.key}>
                  <button className="strip-item" onClick={() => onOpenObject(other.key)}>
                    <span
                      className={`strip-art ${other.thumbnail ? '' : 'blank'}`}
                      style={other.thumbnail ? undefined : { color: info.color }}
                    >
                      {other.thumbnail ? (
                        <img src={other.thumbnail} alt="" loading="lazy" />
                      ) : (
                        info.label.charAt(0)
                      )}
                    </span>
                    <span className="strip-text">
                      <span className="strip-title">{other.title}</span>
                      <span className="strip-sub">{other.subtitle}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {item.tags.length > 0 && (
        <nav className="object-tag-row" aria-label="Tags on this item">
          {item.tags.map((tag) => (
            <button
              key={tag.toLowerCase()}
              className="tag-chip"
              style={tagColors(tag)}
              onClick={() => onSelectTag(tag)}
              title={`Show everything tagged ${tag}`}
            >
              {tag}
            </button>
          ))}
        </nav>
      )}
    </article>
  )
}
