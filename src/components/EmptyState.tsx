import { Setup } from './Setup'

type Props = {
  /** The library has items, but none survived the current filter or search. */
  filtered: boolean
  /** Nothing left unwatched — worth celebrating rather than reporting as empty. */
  queueCleared: boolean
  onShowAll: () => void
}

export function EmptyState({ filtered, queueCleared, onShowAll }: Props) {
  if (queueCleared) {
    return (
      <div className="empty">
        <h2>You are all caught up</h2>
        <p>Everything in your library is marked watched. Nothing left in the queue.</p>
        <button className="btn" onClick={onShowAll}>
          Show the whole library
        </button>
      </div>
    )
  }

  if (filtered) {
    return (
      <div className="empty">
        <h2>Nothing matches</h2>
        <p>Try a different search or filter.</p>
      </div>
    )
  }

  return (
    <div className="empty">
      <h2>Your library is empty</h2>
      <p>
        YouPlay holds YouTube and Spotify links side by side. Tapping one hands off to the
        app it came from. Here is how to get links in:
      </p>
      <Setup />
    </div>
  )
}
