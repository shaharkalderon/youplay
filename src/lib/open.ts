import type { LibraryItem } from './store.ts'

/**
 * Opens an item in its source app.
 *
 * We always use the canonical https link, on every platform.
 *
 * The tempting alternative is to send desktop users straight to a native scheme
 * (`spotify:track:…`) so the desktop client opens without a browser hop. That
 * was the original behaviour and it was wrong: when the scheme has no handler —
 * no desktop client installed, or a browser that refuses unknown schemes, as
 * embedded and sandboxed ones do — the navigation fails *silently*. The click
 * did nothing at all, with no error to react to.
 *
 * Detecting that failure is not reliably possible. The usual trick is to race a
 * timer against a focus or visibility change and treat "we lost focus" as "the
 * app opened", but those events fire for unrelated reasons and, in some
 * browsers, within a few milliseconds of the attempt itself — which cancels the
 * fallback exactly when it is most needed.
 *
 * So we delegate. `youtube.com` and `open.spotify.com` are registered as
 * universal / app links on phones, so the OS hands off to the installed app
 * directly. On desktop their pages offer to open the native client themselves.
 * That path is better tested than anything we could reproduce here, and its
 * worst case is a working web player rather than nothing at all.
 */
export function openItem(item: LibraryItem) {
  window.open(item.url, '_blank', 'noopener,noreferrer')
}
