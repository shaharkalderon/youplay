/**
 * The registry of object types — the things this second brain can hold.
 *
 * Only weblinks exist today, but every screen reads the type from here rather
 * than hard-coding "Weblinks", so adding notes, books or people later is a new
 * entry plus a view, not a rewrite of the shell.
 *
 * Deliberately free of React and browser imports, like the other pure modules,
 * so it can be exercised straight from the test script. The `icon` is a name
 * the sidebar resolves to a component rather than the component itself.
 */

export type ObjectTypeId = 'weblink'

export type ObjectType = {
  id: ObjectTypeId
  /** Plural: what the sidebar entry and the type's own page are called. */
  label: string
  /** Singular, for counts and empty states — "1 weblink". */
  singular: string
  /** Resolved to a component by the UI; keeps this module React-free. */
  icon: string
  /** Accent for the type's icon tile. */
  color: string
  /** One line saying what belongs in this type. */
  blurb: string
}

export const OBJECT_TYPES: ObjectType[] = [
  {
    id: 'weblink',
    label: 'Weblinks',
    singular: 'weblink',
    icon: 'link',
    color: '#3ea6ff',
    blurb: 'Anything you found online — videos, tracks, posts, articles.',
  },
]

export const DEFAULT_TYPE: ObjectTypeId = 'weblink'

export const objectType = (id: ObjectTypeId): ObjectType =>
  OBJECT_TYPES.find((type) => type.id === id) ?? OBJECT_TYPES[0]

export const isObjectTypeId = (value: unknown): value is ObjectTypeId =>
  OBJECT_TYPES.some((type) => type.id === value)

/** "1 weblink" / "4 weblinks" — the plural label is not always the singular + s
 *  once more types exist, so both forms live in the registry. */
export const countLabel = (type: ObjectType, count: number): string =>
  `${count} ${count === 1 ? type.singular : type.label.toLowerCase()}`
