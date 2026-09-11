import { removeChannel, type Channel } from '../lib/channels.ts'
import type { FeedStatus } from '../lib/feed.ts'
import type { Layout } from '../lib/layout.ts'
import { FEED_DAY_OPTIONS, setFeedDays, type FeedDays } from '../lib/preferences.ts'
import type { LibraryItem } from '../lib/store.ts'
import { relativeTime } from '../lib/time.ts'
import { isYouTubeConfigured, type FeedVideo } from '../lib/youtube.ts'
import { FeedCard } from './FeedCard'
import { CloseIcon, PlusIcon } from './Icons'

type Props = {
  channels: Channel[]
  videos: FeedVideo[]
  status: FeedStatus
  days: FeedDays
  layout: Layout
  query: string
  library: LibraryItem[]
  onRefresh: () => void
  onAddChannel: () => void
  onSave: (video: FeedVideo) => void
}

const windowLabel = (days: FeedDays) => (days === '1' ? '24 hours' : `${days} days`)

export function FeedView(props: Props) {
  const { channels, videos, status, days, layout, query, library, onRefresh, onAddChannel, onSave } =
    props

  if (!isYouTubeConfigured) {
    return (
      <div className="empty">
        <h2>The channel feed is not set up yet</h2>
        <p>
          New uploads from channels you follow are read through the YouTube Data API, which
          needs a free API key. Add it as <code>VITE_YOUTUBE_API_KEY</code> and redeploy — the
          README walks through it. Everything else works without it.
        </p>
      </div>
    )
  }

  const channelsById = new Map(channels.map((channel) => [channel.id, channel]))
  const savedById = new Map(
    library.filter((item) => item.platform === 'youtube').map((item) => [item.id, item])
  )
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? videos.filter(
        (video) =>
          video.title.toLowerCase().includes(needle) ||
          video.channelTitle.toLowerCase().includes(needle)
      )
    : videos
  const failing = channels.filter((channel) => status.errors[channel.id])

  return (
    <>
      <section className="feed-head">
        <div className="feed-bar">
          <div className="segmented" role="group" aria-label="How far back to look">
            {FEED_DAY_OPTIONS.map((option) => (
              <button
                key={option}
                className="segment"
                aria-pressed={option === days}
                onClick={() => setFeedDays(option)}
              >
                {option === '1' ? '24h' : `${option} days`}
              </button>
            ))}
          </div>

          <span className="feed-status" role="status">
            {status.loading
              ? 'Checking for new videos…'
              : status.lastRefreshedAt
                ? `Checked ${relativeTime(status.lastRefreshedAt)}`
                : ''}
          </span>

          <button
            className="btn small"
            onClick={onRefresh}
            disabled={status.loading || channels.length === 0}
          >
            Refresh
          </button>
        </div>

        <div className="channel-strip" role="list" aria-label="Channels you follow">
          {channels.map((channel) => (
            <div
              key={channel.key}
              role="listitem"
              className={`channel-pill ${status.errors[channel.id] ? 'has-error' : ''}`}
              title={status.errors[channel.id] ?? channel.handle ?? channel.title}
            >
              {channel.thumbnail ? (
                <img src={channel.thumbnail} alt="" loading="lazy" />
              ) : (
                <span className="channel-initial">{channel.title.charAt(0).toUpperCase()}</span>
              )}
              <span className="channel-name">{channel.title}</span>
              <button
                className="channel-remove"
                onClick={() => removeChannel(channel.key)}
                aria-label={`Unfollow ${channel.title}`}
                title="Unfollow"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <button className="channel-pill add" onClick={onAddChannel}>
            <PlusIcon />
            Add channel
          </button>
        </div>

        {status.fatal && <p className="banner error">{status.fatal}</p>}
        {!status.fatal && failing.length > 0 && (
          <p className="hint">
            Could not load {failing.map((channel) => channel.title).join(', ')}. Refresh to
            try again.
          </p>
        )}
      </section>

      {channels.length === 0 ? (
        <div className="empty">
          <h2>Follow your first channel</h2>
          <p>
            Its uploads from the last {windowLabel(days)} will show up here whenever you open
            YouPlay. Paste an @handle, a channel link, or a link to any of its videos — or
            share a channel from the YouTube app.
          </p>
          <button className="btn primary" onClick={onAddChannel}>
            Add a channel
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <h2>{needle ? 'Nothing matches' : status.loading ? 'Checking your channels…' : 'Nothing new'}</h2>
          <p>
            {needle
              ? 'Try a different search.'
              : `No uploads from your ${channels.length === 1 ? 'channel' : `${channels.length} channels`} in the last ${windowLabel(days)}.`}
          </p>
        </div>
      ) : (
        <div className={`grid layout-${layout}`}>
          {shown.map((video) => (
            <FeedCard
              key={video.videoId}
              video={video}
              channel={channelsById.get(video.channelId)}
              saved={savedById.get(video.videoId)}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </>
  )
}
