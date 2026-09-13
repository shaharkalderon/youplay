import { libraryStats } from '../lib/stats.ts'
import type { LibraryItem } from '../lib/store.ts'
import { absoluteTime, relativeTime } from '../lib/time.ts'
import { SyncPanel } from './SyncPanel'
import { Setup } from './Setup'

type Props = {
  items: LibraryItem[]
  sync: {
    code: string | null
    enable: () => void
    join: (input: string) => boolean
    disable: () => void
  }
  onOpenData: () => void
}

const dateLine = (timestamp: number | null) =>
  timestamp === null ? '—' : relativeTime(timestamp)

export function Profile({ items, sync, onOpenData }: Props) {
  const stats = libraryStats(items)

  return (
    <div className="profile">
      <header className="profile-head">
        <div className="profile-avatar" aria-hidden="true">
          Y
        </div>
        <div>
          <h1>Your library</h1>
          <p>
            {sync.code
              ? 'Syncing across every device that has your code.'
              : 'Stored on this device only. Turn on sync below.'}
          </p>
        </div>
      </header>

      <section className="profile-section">
        <h2>Library</h2>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">saved</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.unwatched}</span>
            <span className="stat-label">in the queue</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.watched}</span>
            <span className="stat-label">watched</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.watchedPercent}%</span>
            <span className="stat-label">worked through</span>
          </div>
        </div>

        {stats.total > 0 && (
          <>
            <div
              className="split-bar"
              role="img"
              aria-label={stats.byPlatform.map((p) => `${p.count} from ${p.label}`).join(', ')}
            >
              {stats.byPlatform.map((entry) => (
                <span
                  key={entry.platform}
                  style={{ flexGrow: entry.count, background: entry.color }}
                />
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

            <ul className="kind-list">
              {stats.byKind.map(({ kind, label, count }) => (
                <li key={kind}>
                  <span>{label}</span>
                  <span className="kind-count">{count}</span>
                </li>
              ))}
            </ul>

            <dl className="fact-list">
              <div>
                <dt>First saved</dt>
                <dd title={stats.firstAddedAt ? absoluteTime(stats.firstAddedAt) : undefined}>
                  {dateLine(stats.firstAddedAt)}
                </dd>
              </div>
              <div>
                <dt>Last saved</dt>
                <dd title={stats.lastAddedAt ? absoluteTime(stats.lastAddedAt) : undefined}>
                  {dateLine(stats.lastAddedAt)}
                </dd>
              </div>
              <div>
                <dt>Last watched</dt>
                <dd title={stats.lastWatchedAt ? absoluteTime(stats.lastWatchedAt) : undefined}>
                  {dateLine(stats.lastWatchedAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className="profile-section">
        <SyncPanel
          code={sync.code}
          onEnable={sync.enable}
          onJoin={sync.join}
          onDisable={sync.disable}
        />
      </section>

      <section className="profile-section">
        <h2>Your data</h2>
        <p className="hint">
          Keep a backup, move your library by hand, or restore it after clearing site data.
        </p>
        <button className="btn" onClick={onOpenData}>
          Export or import
        </button>
      </section>

      <section className="profile-section">
        <h2>Saving links</h2>
        <Setup />
      </section>
    </div>
  )
}
