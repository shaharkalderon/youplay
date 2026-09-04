/**
 * Share-sheet setup guidance. Android/Chrome installs get a real Web Share
 * Target; iOS Safari does not implement that API at all, so there the same
 * intake is driven by a one-step Shortcut that opens /?url=…
 */
export function Setup() {
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  return (
    <ol className="steps">
      <li className="step">
        <span className="num">1</span>
        <div>
          <h3>Install YouPlay</h3>
          <p>
            Android / Chrome: menu → <strong>Install app</strong>. iPhone: Share →{' '}
            <strong>Add to Home Screen</strong>. Installing is what registers it as a share
            destination.
          </p>
        </div>
      </li>
      <li className="step">
        <span className="num">2</span>
        <div>
          <h3>Android: share straight from the app</h3>
          <p>
            In YouTube or Spotify, tap <strong>Share</strong> and pick <strong>YouPlay</strong>. It
            lands in your library instantly.
          </p>
        </div>
      </li>
      <li className="step">
        <span className="num">3</span>
        <div>
          <h3>iPhone: add a Shortcut</h3>
          <p>
            iOS has no share-target support, so make a Shortcut with{' '}
            <strong>Receive URLs from Share Sheet</strong> → <strong>Open URL</strong> set to{' '}
            <code>{origin}/?link=</code> joined with the shared URL. Name it “Save to YouPlay” and it
            appears in every share sheet.
          </p>
        </div>
      </li>
      <li className="step">
        <span className="num">4</span>
        <div>
          <h3>Desktop: paste it</h3>
          <p>
            Use <strong>Add link</strong> and paste any YouTube or Spotify URL — videos, Shorts,
            playlists, tracks, albums, artists, podcasts and episodes all work.
          </p>
        </div>
      </li>
    </ol>
  )
}
