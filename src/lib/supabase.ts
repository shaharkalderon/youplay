const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Sync is optional. With no credentials compiled in the app is local-only, with
 * no errors and no UI promising something that cannot work.
 */
export const isSyncConfigured = Boolean(url && anonKey)

/**
 * Calls a Postgres function through PostgREST.
 *
 * We talk to the two RPC endpoints directly rather than pulling in the Supabase
 * client: there is no auth to manage in this model, so the client would add a
 * couple of hundred kilobytes to do what one fetch does.
 */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!isSyncConfigured) throw new Error('Sync is not configured for this build.')

  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    const detail = await response.text()
    let message = `${response.status} ${response.statusText}`
    try {
      const parsed = JSON.parse(detail)
      if (parsed.message) message = parsed.message
    } catch {
      // Non-JSON error body; the status line is the best we have.
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}
