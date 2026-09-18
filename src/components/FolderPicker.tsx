import { useEffect, useRef, useState } from 'react'
import { folderDepth, normaliseFolderPath, sameFolder } from '../lib/folders.ts'
import { FolderIcon } from './Icons'

/**
 * Sentinels that no real folder can collide with. `normaliseFolderPath` drops
 * empty segments, so a stored path never starts with a separator and is never
 * empty - which makes both of these unreachable by an actual folder. A plain
 * 'new' would not be: name a folder "new" and choosing it would open the
 * create field instead of filing anything there.
 */
const NEW = '/new'
const UNFILED = ''

type Props = {
  value: string | null
  /** Every folder that exists, in tree order, so the list reads as a tree. */
  folders: string[]
  onChange: (path: string | null) => void
}

/**
 * Where an item is filed.
 *
 * A native `<select>` rather than a custom menu: it is one tap on a phone, it
 * gets keyboard and screen-reader behaviour for free, and the list of folders is
 * short by design. Creating a folder is the last option in it, which reveals a
 * field, so filing somewhere new never means leaving the item first.
 */
export function FolderPicker({ value, folders, onChange }: Props) {
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  // A folder can exist on the item without existing in the tree yet: filed on
  // another device whose sync has landed but whose items have not. Adding it
  // keeps the select from reading "Unfiled" for something plainly filed.
  const options =
    value && !folders.some((path) => sameFolder(path, value)) ? [...folders, value] : folders

  if (creating) {
    return (
      <div className="folder-picker">
        <input
          ref={inputRef}
          className="folder-input"
          placeholder="Work/Research"
          aria-label="New folder path"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const path = normaliseFolderPath(event.currentTarget.value)
              if (path) onChange(path)
              setCreating(false)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setCreating(false)
            }
          }}
          // Blur commits like Enter does, so clicking away from a typed name
          // files the item rather than silently discarding it.
          onBlur={(event) => {
            const path = normaliseFolderPath(event.target.value)
            if (path) onChange(path)
            setCreating(false)
          }}
        />
        <p className="hint">
          Use <code>/</code> to nest, as in <code>Work/Research</code>. Enter to file it,
          Escape to stop.
        </p>
      </div>
    )
  }

  return (
    <div className="folder-picker">
      <FolderIcon />
      <select
        className="folder-select"
        value={value ?? UNFILED}
        aria-label="Folder"
        onChange={(event) => {
          const next = event.target.value
          if (next === NEW) {
            setCreating(true)
            return
          }
          onChange(next === UNFILED ? null : next)
        }}
      >
        <option value={UNFILED}>Unfiled</option>
        {options.map((path) => (
          <option key={path.toLowerCase()} value={path}>
            {/* Indented by depth so the flat list still reads as a tree. The
                padding is a no-break space: a select collapses ordinary ones. */}
            {'  '.repeat(folderDepth(path) - 1)}
            {path}
          </option>
        ))}
        <option value={NEW}>+ New folder</option>
      </select>
    </div>
  )
}
