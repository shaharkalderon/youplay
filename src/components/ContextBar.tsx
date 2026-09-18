import { useEffect, useRef, useState } from 'react'
import { folderName } from '../lib/folders.ts'
import { tagColors } from '../lib/tags.ts'
import { FolderIcon, TagIcon, TrashIcon, PencilIcon, CloseIcon } from './Icons'

type Props = {
  kind: 'tag' | 'folder'
  /** The full name: a tag, or a folder path. */
  value: string
  count: number
  onRename: (next: string) => void
  onDelete: () => void
  onClear: () => void
}

/**
 * The header for a slice of the list: which tag or folder you are looking at,
 * how much is in it, and the two things you might want to do to it.
 *
 * Renaming and deleting live here rather than in a menu on the sidebar row
 * because this is where you can see what you are about to change. A sidebar
 * popover would ask you to rename a folder while looking at a list of other
 * folders, and on a phone there is nowhere sensible to put one.
 */
export function ContextBar({ kind, value, count, onRename, onDelete, onClear }: Props) {
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  // Moving to a different tag or folder must not carry a half-finished rename
  // or an armed delete along with it.
  useEffect(() => {
    setRenaming(false)
    setConfirming(false)
  }, [kind, value])

  const isTag = kind === 'tag'
  const label = isTag ? value : folderName(value)
  const noun = isTag ? 'tag' : 'folder'

  return (
    <div className="context-bar">
      <span className="context-mark" style={isTag ? { color: tagColors(value).color } : undefined}>
        {isTag ? <TagIcon /> : <FolderIcon />}
      </span>

      {renaming ? (
        <input
          ref={inputRef}
          className="context-input"
          defaultValue={isTag ? value : value}
          aria-label={`Rename this ${noun}`}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              event.currentTarget.value = value
              event.currentTarget.blur()
            }
          }}
          onBlur={(event) => {
            const next = event.target.value
            setRenaming(false)
            if (next && next !== value) onRename(next)
          }}
        />
      ) : (
        <h2 className="context-name" title={value}>
          {label}
          <span className="context-count">{count}</span>
        </h2>
      )}

      {!renaming && (
        <div className="context-tools">
          {confirming ? (
            <>
              <span className="context-warn">
                {isTag
                  ? `Remove ${label} from ${count} ${count === 1 ? 'item' : 'items'}?`
                  : `Unfile ${count} ${count === 1 ? 'item' : 'items'}?`}
              </span>
              <button className="btn small danger" onClick={onDelete}>
                Delete the {noun}
              </button>
              <button className="btn small" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="btn small ghost"
                onClick={() => setRenaming(true)}
                aria-label={`Rename this ${noun}`}
              >
                <PencilIcon />
                Rename
              </button>
              <button
                className="btn small ghost"
                onClick={() => setConfirming(true)}
                aria-label={`Delete this ${noun}`}
              >
                <TrashIcon />
                Delete
              </button>
              <button className="btn small ghost" onClick={onClear} aria-label="Show everything">
                <CloseIcon />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
