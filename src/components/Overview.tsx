import { openItem } from '../lib/open.ts'
import { platformInfo } from '../lib/platforms.ts'
import { libraryStats } from '../lib/stats.ts'
import type { LibraryItem } from '../lib/store.ts'
import { tagColors, tagCounts } from '../lib/tags.ts'
import { relativeTime } from '../lib/time.ts'
import { ChevronIcon, NoteIcon } from './Icons'

type Props = {
  items: LibraryItem[]
  onSelectTag: (tag: string) => void
  onShowAll: () => void
  onShowQueue: () => void
}

/** Short enough that each strip stays a glance rather than a second list. */
const STRIP = 5

/** One clickable line: artwork, title, and what the item is about. */
function Strip({ items }: { items: LibraryItem[] }) {
  return (
    <ul className="strip">
      {items.map((item) => {
        const platform = platformInfo(item.platform)
        return (
          <li key={item.key}>
            <button className="strip-item" onClick={() => openItem(item)}>
              <span
                className={`strip-art ${item.thumbnail ? '' : 'blank'}`}
                style={item.thumbnail ? undefined : { color: platform.color }}
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" loading="lazy" />
                ) : (
                  platform.label.charAt(0)
                )}
              </span>
              <span className="strip-text">
                <span className="strip-title">{item.title}</span>
                <span className="strip-sub">
                  {item.note ? (
                    <>
                      <NoteIcon />
                      {item.note}
                    </>
                  ) : (
                    item.subtitle
                  )}
                </span>
              </span>
              <span className="strip-when">{relativeTime(item.addedAt)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The type at a glance: how much is in it, what to do next, and the shapes you
 * can slice it by. Everything here is a way *into* the list — the overview is a
 * dashboard you pass through, not somewhere to work.
 */
export function Overview({ items, onSelectTag, onShowAll, onShowQueue }: Props) {
  const stats = libraryStats(items)
  const tags = tagCounts(items)

  // Oldest first: the queue is a backlog, and the thing that has waited longest
  // is the thing most likely to be forgotten entirely.
  const queue = items
    .filter((item) => item.watchedAt === null)
    .sort((a, b) => a.addedAt - b.addedAt)
    .slice(0, STRIP)

  const recent = [...items].sort((a, b) => b.addedAt - a.addedAt).slice(0, STRIP)

  if (items.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing here yet</h2>
        <p>
          Save your first link and this becomes a picture of what you are collecting — what
          is waiting, where it comes from, and how you have tagged it.
        </p>
      </div>
    )
  }

  return (
    <div className="overview">
      <div className="stat-grid">
        <button className="stat" onClick={onShowAll}>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">saved</span>
        </button>
        <button className="stat" onClick={onShowQueue}>
          <span className="stat-value">{stats.unwatched}</span>
          <span className="stat-label">in the queue</span>
        </button>
        <div className="stat">
          <span className="stat-value">{stats.watchedPercent}%</span>
          <span className="stat-label">worked through</span>
        </div>
        <div className="stat">
          <span className="stat-value">{tags.length}</span>
          <span className="stat-label">{tags.length === 1 ? 'tag' : 'tags'}</span>
        </div>
      </div>

      <div className="overview-columns">
        {queue.length > 0 && (
          <section className="panel">
            <h2>
              Next in your queue
              <button className="link-button" onClick={onShowQueue}>
                All {stats.unwatched}
                <ChevronIcon />
              </button>
            </h2>
            <Strip items={queue} />
          </section>
        )}

        <section className="panel">
          <h2>
            Recently saved
            <button className="link-button" onClick={onShowAll}>
              All {stats.total}
              <ChevronIcon />
            </button>
          </h2>
          <Strip items={recent} />
        </section>
      </div>

      {tags.length > 0 && (
        <section className="panel">
          <h2>Tags</h2>
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
        </section>
      )}

      <section className="panel">
        <h2>Where it comes from</h2>
        <div
          className="split-bar"
          role="img"
          aria-label={stats.byPlatform.map((p) => `${p.count} from ${p.label}`).join(', ')}
        >
          {stats.byPlatform.map((entry) => (
            <span key={entry.platform} style={{ flexGrow: entry.count, background: entry.color }} />
          ))}
        </div>
        <p className="split-legend">
          {stats.byPlatform.map((entry) => (
            <span key={entry.platform} className="legend-entry">
              <span className="dot" style={{ background: entry.color }} />
              {entry.label} {entry.count}
            </span>
          ))}
        </p>
      </section>
    </div>
  )
}
