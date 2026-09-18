import { useId, useState, type KeyboardEvent } from 'react'
import { addTag, MAX_TAGS_PER_ITEM, removeTag, tagColors } from '../lib/tags.ts'

type Props = {
  tags: string[]
  /** Every tag already in use, offered as suggestions so tags converge on one
   *  spelling instead of quietly forking into near-duplicates. */
  suggestions: string[]
  onChange: (tags: string[]) => void
}

/**
 * The tag list of one item, editable. Shared by the edit sheet and the object
 * page so the two cannot drift apart in what they accept.
 */
export function TagEditor({ tags, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const listId = useId()

  const full = tags.length >= MAX_TAGS_PER_ITEM

  function commit(raw: string) {
    const next = addTag(tags, raw)
    // `addTag` hands back the same array for a duplicate or a blank, which is
    // the signal to skip the write and the sync stamp that comes with it.
    if (next !== tags) onChange(next)
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter inside a form would otherwise submit the whole sheet while the
      // user is still building their tag list.
      event.preventDefault()
      commit(draft)
      return
    }
    // Backspace on an empty field takes back the last chip — the behaviour every
    // tag input has, and the only way to fix a typo without the mouse.
    if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      event.preventDefault()
      onChange(tags.slice(0, -1))
    }
  }

  // Suggestions already on this item are dropped: offering a tag that would be
  // rejected as a duplicate is just noise in the dropdown.
  const offered = suggestions.filter(
    (tag) => !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())
  )

  return (
    <div className="tag-editor">
      {tags.map((tag) => (
        <span key={tag.toLowerCase()} className="tag-chip" style={tagColors(tag)}>
          {tag}
          <button
            type="button"
            className="tag-remove"
            onClick={() => onChange(removeTag(tags, tag))}
            aria-label={`Remove the tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        list={listId}
        disabled={full}
        aria-label="Add a tag"
        placeholder={full ? `${MAX_TAGS_PER_ITEM} is the limit` : tags.length === 0 ? 'Add a tag…' : ''}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
      <datalist id={listId}>
        {offered.map((tag) => (
          <option key={tag.toLowerCase()} value={tag} />
        ))}
      </datalist>
    </div>
  )
}
