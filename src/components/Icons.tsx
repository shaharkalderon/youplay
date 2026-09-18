export const LogoIcon = () => (
  <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true">
    <rect width="28" height="20" rx="6" fill="#0f0f0f" />
    <path d="M11 5.5 L18.5 10 L11 14.5 Z" fill="#ff0033" />
    <path d="M14.75 7.75 L18.5 10 L14.75 12.25 Z" fill="#1ed760" />
  </svg>
)

export const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
  </svg>
)

export const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const PlayIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.55)" />
    <path d="M19 15 L34 24 L19 33 Z" fill="#fff" />
  </svg>
)

export const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
)

export const CompactIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="3" width="5" height="5" rx="1" />
    <rect x="9.5" y="3" width="5" height="5" rx="1" />
    <rect x="16" y="3" width="5" height="5" rx="1" />
    <rect x="3" y="9.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    <rect x="16" y="9.5" width="5" height="5" rx="1" />
    <rect x="3" y="16" width="5" height="5" rx="1" />
    <rect x="9.5" y="16" width="5" height="5" rx="1" />
    <rect x="16" y="16" width="5" height="5" rx="1" />
  </svg>
)

export const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="4" width="7" height="5" rx="1" />
    <rect x="12" y="5" width="9" height="1.6" rx="0.8" />
    <rect x="12" y="7.4" width="6" height="1.6" rx="0.8" />
    <rect x="3" y="15" width="7" height="5" rx="1" />
    <rect x="12" y="16" width="9" height="1.6" rx="0.8" />
    <rect x="12" y="18.4" width="6" height="1.6" rx="0.8" />
  </svg>
)

export const SortIcon = ({ ascending }: { ascending: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ transform: ascending ? 'scaleY(-1)' : undefined }}
  >
    <path d="M7 4v16" />
    <path d="M3.5 16.5 7 20l3.5-3.5" />
    <path d="M13 6h8" />
    <path d="M13 11h6" />
    <path d="M13 16h4" />
  </svg>
)

export const RowsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="4.5" width="3" height="2.4" rx="0.6" />
    <rect x="7.5" y="4.8" width="13.5" height="1.8" rx="0.9" />
    <rect x="3" y="9.3" width="3" height="2.4" rx="0.6" />
    <rect x="7.5" y="9.6" width="13.5" height="1.8" rx="0.9" />
    <rect x="3" y="14.1" width="3" height="2.4" rx="0.6" />
    <rect x="7.5" y="14.4" width="13.5" height="1.8" rx="0.9" />
    <rect x="3" y="18.9" width="3" height="2.4" rx="0.6" />
    <rect x="7.5" y="19.2" width="13.5" height="1.8" rx="0.9" />
  </svg>
)

export const DataIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v10" />
    <path d="m8.5 9.5 3.5 3.5 3.5-3.5" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
)

export const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)

export const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h11a5 5 0 0 1 0 10H9" />
    <path d="M7.5 5.5 4 9l3.5 3.5" />
  </svg>
)

export const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)

/* ---------- second-brain shell ---------- */

/** The workspace mark in the sidebar. A spark rather than a literal brain:
 *  it has to read at 20px next to a name. */
export const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l1.9 5.4 5.6 1.6-5.6 1.6L12 16.5l-1.9-5.4L4.5 9.5l5.6-1.6z" />
    <path d="M18.5 15l.9 2.4 2.6.8-2.6.8-.9 2.5-.9-2.5-2.6-.8 2.6-.8z" opacity="0.65" />
  </svg>
)

/** The Weblinks object type. */
export const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.6-1.6" />
  </svg>
)

export const TagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12.6V4a1 1 0 0 1 1-1h8.6a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.6 8.6a1 1 0 0 1-1.4 0L3.3 13.3a1 1 0 0 1-.3-.7Z" />
    <circle cx="7.8" cy="7.8" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

/** Collapse / restore the sidebar — a page with its left rail shaded. */
export const PanelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9.5 4v16" />
    <rect x="3.9" y="4.9" width="4.7" height="14.2" rx="1.6" fill="currentColor" stroke="none" opacity="0.45" />
  </svg>
)

/** Opens the sidebar as a drawer on a phone, where it is not always on screen. */
export const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const OverviewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="3" width="8.5" height="11" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6" />
    <rect x="3" y="16" width="8.5" height="5" rx="1.6" />
  </svg>
)

export const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </svg>
)

export const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m8 5 7 7-7 7" />
  </svg>
)

/** Marks an item that carries a note of your own. */
export const NoteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 5h12M6 10h12M6 15h7" />
  </svg>
)

/* ---------- object page, folders and tags ---------- */

/**
 * A collection box rather than a manila folder: the thing it names is a place
 * you put objects, and a box reads that way at 16px far better than a folder
 * tab does.
 */
export const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.4" />
    <path d="M5.5 9v8.6A1.9 1.9 0 0 0 7.4 19.5h9.2a1.9 1.9 0 0 0 1.9-1.9V9" />
    <path d="M10 12.8h4" />
  </svg>
)

export const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

/** Marks a control that leaves the app for the platform the link came from. */
export const ExternalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
)

export const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M9 7V5h6v2" />
    <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </svg>
)

/** Expands and collapses a folder. Rotated by CSS rather than a second icon. */
export const DisclosureIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 5.5 17 12l-8 6.5Z" />
  </svg>
)
