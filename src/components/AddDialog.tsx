import { useEffect, useRef, useState } from 'react'
import { kindLabel, parseLink } from '../lib/links.ts'
import { has } from '../lib/store.ts'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (raw: string) => void
}

export function AddDialog({ open, onClose, onAdd }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

  // Held in a ref so the close listener is attached once and never goes stale.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // `close` does not bubble, so rather than rely on React's synthetic coverage
  // we listen on the element itself. This is what keeps our state in sync when
  // the dialog is dismissed by Escape rather than by our own buttons. We also
  // listen for `cancel` — that is the event Escape fires first, and it lands
  // even on engines that skip `close`.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const sync = () => onCloseRef.current()
    dialog.addEventListener('close', sync)
    dialog.addEventListener('cancel', sync)
    return () => {
      dialog.removeEventListener('close', sync)
      dialog.removeEventListener('cancel', sync)
    }
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setValue('')
      dialog.showModal()
      // The input mounts hidden, so React's autoFocus never lands; focus it here
      // so a paste works the moment the dialog appears.
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const parsed = value.trim() ? parseLink(value) : null
  const duplicate = parsed ? has(parsed) : false
  const invalid = value.trim().length > 0 && !parsed

  return (
    <dialog
      className="sheet"
      ref={ref}
      onClick={(event) => {
        // A modal dialog's backdrop is part of the dialog element itself, so a
        // click landing on the element rather than its contents is a backdrop click.
        if (event.target === ref.current) ref.current.close()
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault()
          if (!parsed || duplicate) return
          onAdd(value)
        }}
      >
        <h2>Add a link</h2>
        <p>Paste a YouTube or Spotify URL. Sharing text around the link is fine — we find it.</p>

        <input
          ref={inputRef}
          type="text"
          inputMode="url"
          placeholder="https://open.spotify.com/track/… or https://youtu.be/…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />

        {invalid && <p className="error">That is not a YouTube or Spotify link we recognise.</p>}
        {parsed && !duplicate && (
          <p>
            Detected: <strong>{parsed.platform === 'youtube' ? 'YouTube' : 'Spotify'}</strong>{' '}
            {kindLabel(parsed.kind).toLowerCase()}
          </p>
        )}
        {duplicate && <p className="error">Already in your library.</p>}

        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!parsed || duplicate}>
            Add
          </button>
        </div>
      </form>
    </dialog>
  )
}
