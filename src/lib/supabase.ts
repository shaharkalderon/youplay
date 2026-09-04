import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Sync is optional. With no credentials compiled in, the app behaves exactly as
 * it did before sync existed — local-only, no errors, no dead UI promising a
 * feature that cannot work.
 */
export const isSyncConfigured = Boolean(url && anonKey)

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * Loaded on demand. supabase-js is far larger than the rest of the app, so it
 * is kept out of the initial bundle and only fetched once sync is actually used.
 */
export function getClient(): Promise<SupabaseClient> {
  if (!isSyncConfigured) {
    return Promise.reject(new Error('Sync is not configured for this build.'))
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url!, anonKey!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The magic-link callback lands back on the app URL with tokens in the
          // hash; let the client consume them, then we tidy the URL ourselves.
          detectSessionInUrl: true,
        },
      })
    )
  }
  return clientPromise
}

/** Where magic links should return to — correct under the /youplay/ subpath. */
export const authRedirectUrl = () =>
  new URL(import.meta.env.BASE_URL, window.location.origin).href
