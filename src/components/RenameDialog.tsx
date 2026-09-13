import { useEffect, useRef, useState } from 'react'
import type { LibraryItem } from '../lib/store.ts'

type Props = {
  /** The item being renamed, or null when the dialog is closed. */
  item: LibraryItem | null
  onClose: () => void
  onSave: (title: string) => void
}

/**
 * Gives an item your own name. This is the only way to make sense of links from
 * platforms that publish no title a browser may read.
 */
export function RenameDialog({ item, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

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

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (item && !dialog.open) {
      setValue(item.title)
      dialog.showModal()
      // Selected, not just focused: replacing a derived title is the common case.
      inputRef.current?.select()
    } else if (!item && dialog.open) {
      dialog.close()
    }
  }, [item])

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
          if (value.trim()) onSave(value)
        }}
      >
        <h2>Rename</h2>
        <p>
          Give this one a name you will recognise. Yours is kept — no later lookup
          will replace it.
        </p>

        <input
          ref={inputRef}
          type="text"
          value={value}
          aria-label="Title"
          placeholder="A name you will recognise"
          onChange={(event) => setValue(event.target.value)}
        />

        {item && <p className="hint">{item.url}</p>}

        <div className="actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
