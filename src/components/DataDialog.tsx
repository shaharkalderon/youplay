import { useEffect, useRef, useState } from 'react'
import { downloadExport, parseImport } from '../lib/transfer.ts'
import { importItems, type LibraryItem } from '../lib/store.ts'

type Props = {
  open: boolean
  onClose: () => void
  items: LibraryItem[]
}

type Status = { tone: 'ok' | 'error'; message: string } | null

export function DataDialog({ open, onClose, items }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>(null)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Same reasoning as AddDialog: `close` does not bubble, so listen on the
  // element rather than relying on React's synthetic event coverage.
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
      setStatus(null)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  async function handleFile(file: File) {
    try {
      const { items: parsed, skipped } = parseImport(await file.text())
      if (parsed.length === 0) {
        setStatus({
          tone: 'error',
          message: 'No usable links in that file.',
        })
        return
      }

      const { added, duplicates } = importItems(parsed)
      const parts = [`Added ${added}`]
      if (duplicates > 0) parts.push(`${duplicates} already saved`)
      if (skipped > 0) parts.push(`${skipped} unreadable`)
      setStatus({ tone: 'ok', message: `${parts.join(' · ')}.` })
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message })
    }
  }

  return (
    <dialog
      className="sheet"
      ref={ref}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close()
      }}
    >
      <div className="sheet-body">
        <h2>Library data</h2>
        <p>
          Your library lives in this browser only. Export it to keep a copy, move to
          another device, or restore after clearing site data.
        </p>

        <div className="data-actions">
          <button
            type="button"
            className="btn primary"
            disabled={items.length === 0}
            onClick={() => {
              downloadExport(items)
              setStatus({
                tone: 'ok',
                message: `Exported ${items.length} ${items.length === 1 ? 'item' : 'items'}.`,
              })
            }}
          >
            Export {items.length > 0 ? `${items.length} items` : 'library'}
          </button>

          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import from file
          </button>
        </div>

        <p className="hint">
          Importing merges: it adds what is missing and never overwrites or removes what
          you already have.
        </p>

        {status && (
          <p className={status.tone === 'error' ? 'error' : 'success'}>{status.message}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Reset so re-picking the same file fires change again.
            event.target.value = ''
            if (file) void handleFile(file)
          }}
        />

        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}
