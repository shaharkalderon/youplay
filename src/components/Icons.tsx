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
