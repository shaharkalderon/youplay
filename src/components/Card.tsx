import { kindLabel } from '../lib/links.ts'
import { platformInfo } from '../lib/platforms.ts'
import { openItem } from '../lib/open.ts'
import { folderName } from '../lib/folders.ts'
import type { LibraryItem } from '../lib/store.ts'
import { tagColors } from '../lib/tags.ts'
import { absoluteTime, relativeTime } from '../lib/time.ts'
import { CheckIcon, CloseIcon, FolderIcon, NoteIcon, PlayIcon, UndoIcon } from './Icons'


type Props = {
  item: LibraryItem
  onRemove: (key: string) => void
  onToggleWatched: (key: string) => void
  onSelectTag: (tag: string) => void
  /** Opens the item's own page inside the app. */
  onOpen: (key: string) => void
  onSelectFolder: (path: string) => void
}

export function Card(props: Props) {
  const { item, onRemove, onToggleWatched, onSelectTag, onOpen, onSelectFolder } = props
  const platform = platformInfo(item.platform)
  const initial = (item.subtitle || platform.label).trim().charAt(0).toUpperCase()
  const watched = item.watchedAt !== null
  // Square artwork (album covers, Instagram posts) is centred over a blurred
  // copy of itself so every tile keeps the same 16:9 rhythm.
  const squareArt = Boolean(platform.squareArt)
  // Shimmer only while a lookup is genuinely running. A lookup that is
  // impossible, or that failed, gets the branded tile instead — otherwise a
  // platform that refuses us would leave the card shimmering forever.
  const blank = !item.thumbnail && !item.resolving

  return (
    <div className={`card-shell ${watched ? 'watched' : ''}`}>
      <div className="card">
        {/* The artwork plays it; the text opens its page. Two buttons rather
            than one, because a button cannot contain another one - and because
            those are genuinely two different intentions. */}
        <button
          className={`thumb ${squareArt ? 'square' : ''} ${blank ? 'blank' : ''} ${
            !item.thumbnail && item.resolving ? 'skeleton' : ''
          }`}
          onClick={() => openItem(item)}
          aria-label={`Open "${item.title}" in ${platform.label}`}
          title={`Open in ${platform.label}`}
        >
          {item.thumbnail && squareArt && (
            <img className="backdrop" src={item.thumbnail} alt="" aria-hidden="true" />
          )}
          {item.thumbnail && <img className="art" src={item.thumbnail} alt="" loading="lazy" />}
          {blank && (
            <span className="blank-mark" style={{ color: platform.color }} aria-hidden="true">
              {platform.label.charAt(0)}
            </span>
          )}
          <div className="play">
            <PlayIcon />
          </div>

          {watched && (
            <div className="badge watched-badge">
              <CheckIcon />
              Watched
            </div>
          )}

          <div className="badge">
            <span className="dot" style={{ background: platform.color }} />
            {kindLabel(item.kind)}
          </div>
        </button>

        <button
          className="meta"
          onClick={() => onOpen(item.key)}
          aria-label={`Open the page for "${item.title}"`}
        >
          <div className="avatar" style={{ background: platform.color }} aria-hidden="true">
            {initial}
          </div>
          <div className="meta-text">
            <h3 className="title">{item.title}</h3>
            <p className="subtitle">
              {item.subtitle}
              {item.resolving ? ' · loading…' : ''}
            </p>
            {item.note && (
              <span className="note-mark" title={item.note}>
                <NoteIcon />
                Note
              </span>
            )}
            <p
              className="subtitle added"
              title={
                watched
                  ? `Added ${absoluteTime(item.addedAt)} · watched ${absoluteTime(item.watchedAt!)}`
                  : `Added ${absoluteTime(item.addedAt)}`
              }
            >
              {watched ? (
                <>Watched {relativeTime(item.watchedAt!)}</>
              ) : (
                <>
                  <span className="added-label">Added </span>
                  {relativeTime(item.addedAt)}
                </>
              )}
            </p>
          </div>
        </button>
      </div>

      {(item.tags.length > 0 || item.folder) && (
        <div className="card-tags">
          {item.folder && (
            <button
              className="folder-chip"
              onClick={() => onSelectFolder(item.folder as string)}
              title={`Show everything in ${item.folder}`}
            >
              <FolderIcon />
              {folderName(item.folder)}
            </button>
          )}
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
        </div>
      )}

      {/* Grouped so each layout only has to position one container. */}
      <div className="card-tools">
        <button
          className={`tool watch-toggle ${watched ? 'is-watched' : ''}`}
          onClick={() => onToggleWatched(item.key)}
          aria-pressed={watched}
          aria-label={
            watched
              ? `Mark "${item.title}" as not watched`
              : `Mark "${item.title}" as watched`
          }
          title={watched ? 'Move back to the queue' : 'Mark as watched'}
        >
          {watched ? <UndoIcon /> : <CheckIcon />}
        </button>

        <button
          className="tool remove"
          onClick={() => onRemove(item.key)}
          aria-label={`Remove "${item.title}" from your library`}
          title="Remove"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
