import { useEffect, useRef, useState } from 'react'
import { addChannel, isFollowing, type Channel } from '../lib/channels.ts'
import {
  isYouTubeConfigured,
  parseChannelInput,
  resolveChannel,
  type ResolvedChannel,
} from '../lib/youtube.ts'

type Props = {
  open: boolean
  /** Pre-filled from a pasted or shared channel link; looked up immediately. */
  initialInput?: string
  onClose: () => void
  onFollowed: (channel: Channel) => void
}

type Phase = 'idle' | 'finding' | 'found' | 'error'

/**
 * Two steps on purpose — find, then follow. Seeing the channel's name and
 * avatar before committing catches the common slip of pasting the wrong link.
 */
export function ChannelDialog({ open, initialInput, onClose, onFollowed }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [found, setFound] = useState<ResolvedChannel | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Ignores a lookup that finishes after the input has already changed.
  const lookupId = useRef(0)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // `close` does not bubble, so listen on the element itself.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const sync = () => onCloseRef.current()
    dialog.addEventListener('close', sync)
    return () => dialog.removeEventListener('close', sync)
  }, [])

  async function find(input: string) {
    const channelRef = parseChannelInput(input)
    if (!channelRef) {
      setPhase('error')
      setError('Paste a channel link, an @handle, or a link to any video from the channel.')
      return
    }
    const id = ++lookupId.current
    setPhase('finding')
    setError(null)
    setFound(null)
    try {
      const channel = await resolveChannel(channelRef)
      if (id !== lookupId.current) return
      setFound(channel)
      setPhase('found')
    } catch (err) {
      if (id !== lookupId.current) return
      setError((err as Error).message)
      setPhase('error')
    }
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      const start = initialInput ?? ''
      setValue(start)
      setFound(null)
      setError(null)
      setPhase('idle')
      dialog.showModal()
      inputRef.current?.focus()
      if (start && isYouTubeConfigured) void find(start)
    } else if (!open && dialog.open) {
      dialog.close()
    }
    // `find` is stable in behaviour; re-running on its identity would re-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialInput])

  const already = found ? isFollowing(found.id) : false

  function follow() {
    if (!found) return
    const channel = addChannel(found)
    if (channel) onFollowed(channel)
    ref.current?.close()
  }

  return (
    <dialog
      className="sheet"
      ref={ref}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (phase === 'found' && found && !already) follow()
          else if (value.trim() && phase !== 'finding') void find(value)
        }}
      >
        <h2>Add a channel</h2>
        <p>Paste a channel link, an @handle, or a link to any video from the channel.</p>

        {!isYouTubeConfigured && (
          <p className="error">The channel feed needs a YouTube API key first — see the README.</p>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="@handle or https://www.youtube.com/@…"
          aria-label="Channel link or handle"
          onChange={(event) => {
            setValue(event.target.value)
            lookupId.current++
            setPhase('idle')
            setFound(null)
            setError(null)
          }}
        />

        {phase === 'finding' && <p className="hint">Looking up the channel…</p>}
        {error && <p className="error">{error}</p>}

        {found && (
          <div className="channel-preview">
            {found.thumbnail ? (
              <img src={found.thumbnail} alt="" />
            ) : (
              <span className="channel-initial">{found.title.charAt(0).toUpperCase()}</span>
            )}
            <div>
              <strong>{found.title}</strong>
              <span className="hint">{found.handle ?? found.id}</span>
            </div>
          </div>
        )}
        {found && already && <p className="hint">You already follow this channel.</p>}

        <div className="actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          {phase === 'found' && found && !already ? (
            <button type="submit" className="btn primary">
              Follow
            </button>
          ) : (
            <button
              type="submit"
              className="btn primary"
              disabled={!value.trim() || phase === 'finding' || !isYouTubeConfigured}
            >
              Find channel
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
