/**
 * A sync code is an unguessable UUID that identifies one shared library.
 *
 * It is a capability, not a username: whoever has it can read and write that
 * library, and without it the server will not hand anything over. There is no
 * account, no email and no password — the trade is that the code is the secret,
 * so it should be shared as carefully as a private link.
 */

const STORAGE_KEY = 'youplay.synccode.v1'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isSyncCode = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value.trim())

/** Accepts a pasted code in any reasonable shape: spaced, upper case, or a
 *  whole `?sync=` URL copied from another device. */
export function normaliseSyncCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromUrl = trimmed.includes('sync=')
    ? new URLSearchParams(trimmed.slice(trimmed.indexOf('?') + 1)).get('sync')
    : null

  const candidate = (fromUrl ?? trimmed).trim().toLowerCase()
  return isSyncCode(candidate) ? candidate : null
}

export function getSyncCode(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isSyncCode(stored) ? stored : null
  } catch {
    return null
  }
}

export function setSyncCode(code: string | null) {
  try {
    if (code === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Storage unavailable: sync simply stays off for this session.
  }
}

/** Creates a new library code. crypto.randomUUID is cryptographically random,
 *  which is what makes the code unguessable rather than merely long. */
export function createSyncCode(): string {
  const code = crypto.randomUUID()
  setSyncCode(code)
  return code
}

/** A link that sets up another device in one tap. */
export const syncLink = (code: string) =>
  `${new URL(import.meta.env.BASE_URL, window.location.origin).href}?sync=${code}`
