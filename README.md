# YouPlay

Your YouTube and Spotify links in one YouTube-style library. Tap anything and it
opens in the app it came from.

- **Aggregates** both platforms into a single grid — videos, Shorts, playlists,
  tracks, albums, artists, podcasts and episodes.
- **Share straight from the source app** via the PWA share target.
- **Paste anywhere** — Cmd/Ctrl+V on the library saves the link, no dialog needed.
- **Four layouts** — grid, compact, list and dense rows — remembered per device.
- **Sort by date added**, newest or oldest first, also remembered.
- **Export / import** your library as JSON, so it survives a cleared cache.
- **Watched state**, turning the pile into a queue you can actually work through.
- **No backend, no API keys, no OAuth.** Titles and artwork come from YouTube's
  and Spotify's public oEmbed endpoints, which allow browser CORS. Your library
  lives in `localStorage` on your device.

## Running it

```bash
npm install && npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm test` | Parser, time, sort, transfer, watched and filter checks (48 cases) |
| `npm run icons` | Regenerate PWA icons |

## Getting links in

Sharing needs the app **installed**, and installing needs **HTTPS** (or
`localhost`). Deploy `dist/` to any static host — Netlify, Vercel, GitHub Pages,
Cloudflare Pages — then:

**Android / Chrome.** Install it (menu → *Install app*). "YouPlay" then appears
in the YouTube and Spotify share sheets. This is the real
[Web Share Target](https://developer.mozilla.org/docs/Web/Manifest/share_target),
declared in `public/manifest.webmanifest`.

**iPhone.** Safari does not implement share targets — there is no way around
this. Use a Shortcut instead:

1. Shortcuts → new shortcut → enable **Show in Share Sheet**, accepting *URLs*.
2. Add **Open URL**, set to **Text**: `https://your-host/?link=` followed by the
   **Shortcut Input** variable.
3. Name it "Save to YouPlay". It now appears in every share sheet.

**Desktop.** Copy a link and press **Cmd/Ctrl+V** anywhere on the library — it
saves immediately. **Add link** does the same with a visible field. Either way,
pasting the whole shared blurb is fine: the parser digs the URL out of the
surrounding text.

Paste is deliberately conservative. It never fires while you are typing in the
search box or the dialog, and pasting ordinary text stays silent — you only get
a warning when the clipboard held something URL-shaped that we could not place.

## Layouts

| Layout | Shape | Item height |
| --- | --- | --- |
| Grid | Default. Full-width cards, ~280px columns. | ~330px |
| Compact | Denser columns (~190px); two-up on a phone. | ~200px |
| List | One row per item, large artwork beside the text. | ~117px |
| Rows | Dense. Single line per item, 64px artwork, dates aligned right for scanning a long library. | ~43px |

In **Rows** the hover overlay and kind badge are dropped (unreadable at that
size), the channel avatar becomes a platform colour dot, and the date sheds its
"Added" prefix. On a phone the channel line goes too, leaving title and date.

The choice is saved to `localStorage` and restored on load. Cards show when each
item was added, relative on the face ("Added 3 days ago") with the exact
timestamp on hover.

## Watched state

Every card has a ✓ control. Marking an item watched stamps it with the time,
adds a **Watched** badge, dims the artwork, and swaps its date line from
"Added 3 days ago" to "Watched 2 hours ago". The same control (now an undo
arrow) puts it back in the queue.

Two filter chips come with it: **Unwatched** — the queue — and **Watched**.

`watchedAt` is a timestamp rather than a boolean, so the card can say *when*,
and a future "recently watched" view has something to sort on. It is carried
through export and import, and backfilled to `null` for libraries saved before
the field existed.

Your last-used filter is remembered too. If it goes stale — you filtered to
Podcasts, then deleted the last one — it falls back to the default on load
rather than opening on a blank screen that would read as data loss.

**The app opens on Unwatched** — the queue — so finished items stop competing
for attention. Nothing is lost: **All** and **Watched** are one click away, and
watched items keep their artwork and titles rather than being archived out of
sight. To open on the full library instead, change the initial `filterId` in
`src/App.tsx` from `'unwatched'` to `'all'`.

## Sorting

The button at the right of the filter row toggles between **Newest first** (the
default) and **Oldest first**, sorting on when you saved the link. It is pinned
beside the chips rather than inside them, so it stays reachable when the filter
strip scrolls. Items saved in the same millisecond break ties on their key, so
the order never shuffles between renders. The choice persists per device.

## How opening works

Every item opens its canonical `https://` link in a new tab, on every platform.
Both `youtube.com` and `open.spotify.com` are registered as universal / app
links, so a phone hands off to the installed app directly, and on desktop those
pages offer to open the native client themselves.

An earlier version sent desktop users straight to a native scheme
(`spotify:track:…`) to skip the browser hop. That was a mistake worth recording:
when nothing handles the scheme — no desktop client, or a browser that refuses
unknown schemes — the navigation fails **silently**, and clicking a Spotify item
did nothing at all.

Detecting that failure is not reliably possible. The usual workaround races a
timer against a focus or visibility change and reads "we lost focus" as "the app
opened", but those events fire for unrelated reasons and, in at least one
browser tested here, within *6ms* of the attempt — cancelling the fallback
exactly when it was needed. Delegating to the platforms' own https handoff is
both simpler and better tested, and its worst case is a working web player
rather than nothing.

## Export and import

The download icon in the header opens **Library data**.

**Export** writes `youplay-library-YYYY-MM-DD.json` — a self-describing envelope
(`app`, `version`, `exportedAt`) wrapping the full library.

**Import merges.** It adds what is missing and never overwrites, reorders or
removes what you already have, so importing the same file twice is a no-op and
re-importing an old backup cannot clobber newer titles. The result line reports
what happened: `Added 2 · 1 already saved · 1 unreadable.`

Nothing in the file is trusted except the link itself. Every entry's platform,
kind, id and canonical URL are **re-derived by running its stored URL back
through the parser**, so a hand-edited `platform` cannot smuggle in an item the
app could not have created itself. Thumbnails are restricted to `http(s)` URLs
(they go straight into an `<img src>`), titles are length-capped, and a bad
`addedAt` falls back to now. Entries that are not usable links are counted and
skipped rather than failing the whole import.

Because the file is plain JSON keyed on ordinary links, it is also a reasonable
way to seed the library from elsewhere: produce `{"items":[{"url":"…"}]}` and
the rest is filled in from oEmbed on import.

## Notes and limitations

- **The share param is `?link=`, not `?url=`.** Vite's dev server reserves
  `?url` for its own asset handling and answers 403. `url`, `text` and `title`
  are still accepted on the way in, so a hand-written shortcut using the obvious
  name works too.
- **Spotify's oEmbed returns no artist field**, so Spotify rows show
  "Spotify · Track" as their second line rather than the artist. Fixing that
  properly needs the Web API, which needs OAuth and a backend for the client
  secret.
- **Private, deleted or region-locked links** fall back to a placeholder card
  with the ID. Unresolved items are retried on every load — sharing into the app
  often kills the lookup mid-flight when you swipe away.
- **Service worker registration is unverified.** It is correct and served with
  the right MIME type, but the sandboxed browser used during development blocks
  registration outright. Confirm in Chrome DevTools → *Application* → *Service
  Workers* after your first real deploy, since installability is what makes the
  share target work.
- The library is per-device. There is no sync — export/import is the manual
  substitute.

## Layout

```
src/lib/links.ts      URL → canonical {platform, kind, id, url, appUri}
src/lib/metadata.ts   oEmbed lookups + graceful fallbacks
src/lib/store.ts      localStorage library, dedupe, retry
src/lib/layout.ts     grid / compact / list definitions
src/lib/sort.ts       sort order + comparator (pure, tested)
src/lib/filters.ts    filter definitions + predicates (pure, tested)
src/lib/preferences.ts  localStorage-backed layout and sort stores
src/lib/time.ts       relative + absolute timestamps
src/lib/transfer.ts   export envelope + defensive import parsing
src/lib/share.ts      share-target / ?link= intake
src/lib/open.ts       hand-off back to YouTube / Spotify
scripts/make-icons.mjs  dependency-free PNG icon generator
```
