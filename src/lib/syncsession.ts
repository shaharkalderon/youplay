import { useCallback, useEffect, useState } from 'react'
import { syncNow } from './remote.ts'
import { isSyncConfigured } from './supabase.ts'
import {
  createSyncCode,
  getSyncCode,
  normaliseSyncCode,
  setSyncCode,
} from './synccode.ts'

/**
 * Owns the sync code and keeps sync running while one exists.
 *
 * Sync runs on load, when the tab regains focus, and every five minutes. The
 * library changes rarely, so a merge-based sync is cheap to run occasionally
 * and wasteful to run continuously.
 */
export function useSync() {
  const [code, setCode] = useState<string | null>(() =>
    isSyncConfigured ? getSyncCode() : null
  )

  // A ?sync=<code> link is how a second device joins in one tap.
  useEffect(() => {
    if (!isSyncConfigured) return
    const params = new URLSearchParams(window.location.search)
    const incoming = params.get('sync')
    if (!incoming) return

    const parsed = normaliseSyncCode(incoming)
    if (parsed) {
      setSyncCode(parsed)
      setCode(parsed)
    }

    // Drop the code from the address bar so it does not linger in history.
    const url = new URL(window.location.href)
    url.searchParams.delete('sync')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])

  useEffect(() => {
    if (!code) return

    void syncNow()

    const onWake = () => {
      if (!document.hidden) void syncNow()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    const timer = window.setInterval(() => void syncNow(), 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.clearInterval(timer)
    }
  }, [code])

  const enable = useCallback(() => setCode(createSyncCode()), [])

  const join = useCallback((input: string) => {
    const parsed = normaliseSyncCode(input)
    if (!parsed) return false
    setSyncCode(parsed)
    setCode(parsed)
    return true
  }, [])

  const disable = useCallback(() => {
    setSyncCode(null)
    setCode(null)
  }, [])

  return { code, enable, join, disable }
}
