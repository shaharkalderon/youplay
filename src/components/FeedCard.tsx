import type { Channel } from '../lib/channels.ts'
import { openItem } from '../lib/open.ts'
import type { LibraryItem } from '../lib/store.ts'
import { absoluteTime, relativeTime } from '../lib/time.ts'
import { watchUrl, type FeedVideo } from '../lib/youtube.ts'
import { CheckIcon, PlayIcon, PlusIcon } from './Icons'

type Props = {
  video: FeedVideo
  channel: Channel | undefined
  /** The library copy, if this video has already been saved. */
  saved: LibraryItem | undefined
  onSave: (video: FeedVideo) => void
}

/**
 * A feed video. Built on the same classes as a library Card, so all four
 * layouts apply to the feed without any layout code of its own.
 */
export function FeedCard({ video, channel, saved, onSave }: Props) {
  const watched = Boolean(saved?.watchedAt)

  return (
    <div className={`card-shell ${watched ? 'watched' : ''}`}>
      <button
        className="card"
        onClick={() => openItem({ url: watchUrl(video.videoId) })}
        aria-label={`Open "${video.title}" in YouTube`}
      >
        <div className="thumb">
          {video.thumbnail && <img className="art" src={video.thumbnail} alt="" loading="lazy" />}
          <div className="play">
            <PlayIcon />
          </div>

          {saved && (
            <div className={`badge watched-badge ${watched ? '' : 'saved-badge'}`}>
              <CheckIcon />
              {watched ? 'Watched' : 'Saved'}
            </div>
          )}

          <div className="badge">
            <span className="dot" style={{ background: 'var(--yt)' }} />
            Video
          </div>
        </div>

        <div className="meta">
          <div className="avatar" style={{ background: 'var(--yt)' }} aria-hidden="true">
            {channel?.thumbnail ? (
              <img src={channel.thumbnail} alt="" loading="lazy" />
            ) : (
              video.channelTitle.charAt(0).toUpperCase()
            )}
          </div>
          <div className="meta-text">
            <h3 className="title">{video.title}</h3>
            <p className="subtitle">{video.channelTitle}</p>
            <p className="subtitle added" title={`Published ${absoluteTime(video.publishedAt)}`}>
              {relativeTime(video.publishedAt)}
            </p>
          </div>
        </div>
      </button>

      <div className="card-tools">
        {saved ? (
          <span
            className="tool is-saved"
            role="img"
            aria-label={`"${video.title}" is in your library`}
            title="Already in your library"
          >
            <CheckIcon />
          </span>
        ) : (
          <button
            className="tool"
            onClick={() => onSave(video)}
            aria-label={`Save "${video.title}" to your library`}
            title="Save to library"
          >
            <PlusIcon />
          </button>
        )}
      </div>
    </div>
  )
}
