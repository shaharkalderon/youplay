import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync, syncNow } from '../lib/remote.ts'
import { isSyncConfigured } from '../lib/supabase.ts'
import { syncLink } from '../lib/synccode.ts'
import { relativeTime } from '../lib/time.ts'

type Props = {
  code: string | null
  onEnable: () => void
  onJoin: (input: string) => boolean
  onDisable: () => void
}

function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState)
}

export function SyncPanel({ code, onEnable, onJoin, onDisable }: Props) {
  const sync = useSyncState()
  const [joining, setJoining] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [, tick] = useState(0)

  // Keeps "Synced 2 minutes ago" honest while the page sits open.
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy(text: string, what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      // Clipboard blocked (permissions, insecure context): the value is on
      // screen and selectable, so this is a convenience, not a requirement.
    }
  }

  if (!isSyncConfigured) {
    return (
      <div className="sync-panel">
        <h3>Sync across devices</h3>
        <p className="hint">
          Not configured for this build. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> and redeploy to turn it on. Everything
          else works without it.
        </p>
      </div>
    )
  }

  if (!code) {
    return (
      <div className="sync-panel">
        <h3>Sync across devices</h3>
        <p className="hint">
          No accounts and no passwords. Turn sync on here, then open the link it gives
          you on your other devices — they all share one library from then on.
        </p>

        <div className="data-actions">
          <button className="btn primary" onClick={onEnable}>
            Turn on sync
          </button>
        </div>

        <form
          className="sync-form"
          onSubmit={(event) => {
            event.preventDefault()
            setJoinError(onJoin(joining) ? null : 'That does not look like a sync code.')
          }}
        >
          <input
            type="text"
            placeholder="Already have a code? Paste it here"
            value={joining}
            onChange={(event) => setJoining(event.target.value)}
            aria-label="Existing sync code"
          />
          <button className="btn" type="submit" disabled={!joining.trim()}>
            Use it
          </button>
        </form>
        {joinError && <p className="error">{joinError}</p>}
      </div>
    )
  }

  const link = syncLink(code)

  return (
    <div className="sync-panel">
      <h3>Sync across devices</h3>

      <p className={sync.status === 'error' ? 'error' : 'hint'}>
        {sync.status === 'syncing' && 'Syncing…'}
        {sync.status === 'error' && `Sync failed: ${sync.message}`}
        {sync.status === 'idle' &&
          (sync.lastSyncedAt ? `Synced ${relativeTime(sync.lastSyncedAt)}.` : 'Not synced yet.')}
      </p>

      <label className="field-label" htmlFor="sync-code">
        Your sync code
      </label>
      <div className="code-row">
        <input id="sync-code" type="text" readOnly value={code} onFocus={(e) => e.target.select()} />
        <button className="btn" onClick={() => void copy(code, 'code')}>
          {copied === 'code' ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="hint">
        Open this link on another device to add it to the same library — or paste the
        code there by hand.
      </p>
      <div className="data-actions">
        <button className="btn" onClick={() => void copy(link, 'link')}>
          {copied === 'link' ? 'Link copied' : 'Copy setup link'}
        </button>
        <button className="btn" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
          Sync now
        </button>
      </div>

      <p className="hint warn">
        Anyone with this code can read and change your library. Treat it like a private
        link and do not post it publicly.
      </p>

      <div className="data-actions">
        <button className="btn" onClick={onDisable}>
          Stop syncing this device
        </button>
      </div>
    </div>
  )
}
