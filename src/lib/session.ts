import { useEffect, useState } from 'react'
import { authRedirectUrl, getClient, isSyncConfigured } from './supabase.ts'
import { syncNow } from './remote.ts'

export type Account = { email: string | null } | null

/**
 * Tracks the signed-in account and keeps sync running while one exists.
 *
 * Sync is triggered on sign-in, when the tab regains focus, and on a slow
 * interval. There is no push-on-every-keystroke: the library changes rarely,
 * and a merge-based sync is cheap to run occasionally but wasteful to run hot.
 */
export function useAccount(): { account: Account; ready: boolean } {
  const [account, setAccount] = useState<Account>(null)
  const [ready, setReady] = useState(!isSyncConfigured)

  useEffect(() => {
    if (!isSyncConfigured) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const supabase = await getClient()

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setAccount(data.session ? { email: data.session.user.email ?? null } : null)
      setReady(true)

      // A magic link returns with tokens in the hash; drop them once consumed so
      // the address bar is clean and a refresh cannot replay them.
      if (window.location.hash.includes('access_token')) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setAccount(session ? { email: session.user.email ?? null } : null)
        if (session) void syncNow()
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!account) return

    const onFocus = () => {
      if (!document.hidden) void syncNow()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => void syncNow(), 5 * 60 * 1000)

    void syncNow()

    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [account])

  return { account, ready }
}

export async function signIn(email: string) {
  const supabase = await getClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl() },
  })
  if (error) throw error
}

export async function signOut() {
  const supabase = await getClient()
  await supabase.auth.signOut()
}
