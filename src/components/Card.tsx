import { kindLabel } from '../lib/links.ts'
import { openItem } from '../lib/open.ts'
import type { LibraryItem } from '../lib/store.ts'
import { absoluteTime, relativeTime } from '../lib/time.ts'
import { CheckIcon, CloseIcon, PlayIcon, UndoIcon } from './Icons'

const PLATFORM = {
  youtube: { label: 'YouTube', color: 'var(--yt)' },
  spotify: { label: 'Spotify', color: 'var(--sp)' },
} as const

/** Spotify serves square cover art; YouTube serves 16:9 stills. */
const isSquareArt = (item: LibraryItem) => item.platform === 'spotify'

type Props = {
  item: LibraryItem
  onRemove: (key: string) => void
  onToggleWatched: (key: string) => void
}

export function Card({ item, onRemove, onToggleWatched }: Props) {
  const platform = PLATFORM[item.platform]
  const initial = (item.subtitle || platform.label).trim().charAt(0).toUpperCase()
  const watched = item.watchedAt !== null

  return (
    <div className={`card-shell ${watched ? 'watched' : ''}`}>
      <button
        className="card"
        onClick={() => openItem(item)}
        aria-label={`Open "${item.title}" in ${platform.label}`}
      >
        <div className={`thumb ${isSquareArt(item) ? 'square' : ''} ${item.thumbnail ? '' : 'skeleton'}`}>
          {item.thumbnail && isSquareArt(item) && (
            <img className="backdrop" src={item.thumbnail} alt="" aria-hidden="true" />
          )}
          {item.thumbnail && <img className="art" src={item.thumbnail} alt="" loading="lazy" />}
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
        </div>

        <div className="meta">
          <div className="avatar" style={{ background: platform.color }} aria-hidden="true">
            {initial}
          </div>
          <div className="meta-text">
            <h3 className="title">{item.title}</h3>
            <p className="subtitle">
              {item.subtitle}
              {item.resolving ? ' · loading…' : ''}
            </p>
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
        </div>
      </button>

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
