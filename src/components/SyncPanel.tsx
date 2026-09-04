import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync, syncNow } from '../lib/remote.ts'
import { signIn, signOut, type Account } from '../lib/session.ts'
import { isSyncConfigured } from '../lib/supabase.ts'
import { relativeTime } from '../lib/time.ts'

function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState)
}

export function SyncPanel({ account }: { account: Account }) {
  const sync = useSyncState()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, forceTick] = useState(0)

  // "Synced 2 minutes ago" would otherwise freeze while the dialog sits open.
  useEffect(() => {
    const timer = window.setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!isSyncConfigured) {
    return (
      <div className="sync-panel">
        <h3>Sync across devices</h3>
        <p className="hint">
          Not configured for this build. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> and redeploy to turn it on — see the README.
          Everything else works without it.
        </p>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="sync-panel">
        <h3>Sync across devices</h3>
        {sent ? (
          <p className="success">
            Check {email} for a sign-in link. Open it on this device to finish.
          </p>
        ) : (
          <>
            <p className="hint">
              Sign in and your library follows you to every device. No password — we email
              you a link.
            </p>
            <form
              className="sync-form"
              onSubmit={async (event) => {
                event.preventDefault()
                setError(null)
                setBusy(true)
                try {
                  await signIn(email.trim())
                  setSent(true)
                } catch (err) {
                  setError((err as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className="btn primary" type="submit" disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Email me a link'}
              </button>
            </form>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="sync-panel">
      <h3>Sync across devices</h3>
      <p className="hint">
        Signed in as <strong>{account.email}</strong>.
      </p>

      <p className={sync.status === 'error' ? 'error' : 'hint'}>
        {sync.status === 'syncing' && 'Syncing…'}
        {sync.status === 'error' && `Sync failed: ${sync.message}`}
        {sync.status === 'idle' &&
          (sync.lastSyncedAt
            ? `Synced ${relativeTime(sync.lastSyncedAt)}.`
            : 'Not synced yet.')}
      </p>

      <div className="data-actions">
        <button
          className="btn"
          onClick={() => void syncNow()}
          disabled={sync.status === 'syncing'}
        >
          Sync now
        </button>
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
