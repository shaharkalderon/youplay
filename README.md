# YouPlay

**Live: https://shaharkalderon.github.io/youplay/**

A second brain for everything you find online. Throw a link at it from anywhere,
and it lands somewhere with a name, your notes on it, and your tags.

The shape is a workspace: a sidebar of **object types** on the left, and the type
you are in on the right. Today there is one type — **Weblinks** — and the app is
built so the next one is a registry entry plus a view, not a rewrite.

- **A workspace shell** — sidebar with your object types, tags and search;
  collapsible on desktop, a drawer on a phone.
- **Weblinks**, the first object type: videos, Shorts, playlists, tracks, albums,
  artists, podcasts, episodes, posts and plain links, from any site.
- **Three views per type** — Overview (the type at a glance), All (the list),
  and New (uploads from channels you follow).
- **An object page** for every item: your note, its tags, where it is filed, and
  what else in your library is related to it.
- **Notes and tags** on every item, searched along with everything else.
- **Folders** — one home per item, nested as deep as you like, alongside tags.
- **Share straight from the source app** via the PWA share target.
- **Paste anywhere** — Cmd/Ctrl+V saves the link, no dialog needed.
- **Four layouts** — grid, compact, list and dense rows — remembered per device.
- **Sort by date added**, newest or oldest first, also remembered.
- **Export / import** as JSON, notes and tags included, so it survives a cleared cache.
- **Watched state**, turning the pile into a queue you can actually work through.
- **Sync across devices** with a code, last-write-wins with tombstones.
- **No backend, no API keys, no OAuth** for the core. Titles and artwork come
  from public oEmbed endpoints that allow browser CORS. Everything lives in
  `localStorage` on your device unless you turn sync on.

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which installs, runs the tests, builds, and publishes `dist/` to GitHub Pages.
A failing test blocks the deploy.

Because Pages serves the app from `/youplay/` rather than a domain root, the
subpath is threaded through carefully:

- `vite.config.ts` sets `base` (override with `BASE_PATH=/ npm run build`).
- `index.html` uses Vite's `%BASE_URL%` placeholder for the manifest and icons.
- The manifest uses **relative** URLs (`./`), which the spec resolves against the
  manifest's own location — so `scope`, `start_url` and the share-target action
  all land on `/youplay/` with no build-time substitution.
- The service worker derives its own base from `self.location`, so it needs no
  substitution either and works at `/` and `/youplay/` alike.

## Running it

```bash
npm install && npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm test` | 164 checks: platforms, parsing, previews, time, sort, transfer, filters, tags, folders, search, object types, merge, store, stats, sync codes and the channel feed |
| `npm run icons` | Regenerate PWA icons |

## Getting links in

Sharing needs the app **installed**, and installing needs **HTTPS**. The live
site above is already installable; open it on your phone and:

**Android / Chrome.** Install it (menu → *Install app*). "YouPlay" then appears
in the YouTube and Spotify share sheets. This is the real
[Web Share Target](https://developer.mozilla.org/docs/Web/Manifest/share_target),
declared in `public/manifest.webmanifest`.

**iPhone.** Safari does not implement share targets — there is no way around
this. Use a Shortcut instead:

1. Shortcuts → new shortcut → enable **Show in Share Sheet**, accepting *URLs*.
2. Add **Open URL**, set to **Text**:
   `https://shaharkalderon.github.io/youplay/?link=` followed by the
   **Shortcut Input** variable.
3. Name it "Save to YouPlay". It now appears in every share sheet.

**Desktop.** Copy a link and press **Cmd/Ctrl+V** anywhere on the library — it
saves immediately. **Add link** does the same with a visible field. Either way,
pasting the whole shared blurb is fine: the parser digs the URL out of the
surrounding text.

Paste is deliberately conservative. It never fires while you are typing in the
search box or the dialog, and pasting ordinary text stays silent — you only get
a warning when the clipboard held something URL-shaped that we could not place.

## The workspace

The sidebar is the app's spine. Top to bottom:

- **The workspace name**, which you can rename in place — click the pencil, type,
  Enter. It is a label on *your* view and nothing more: the app, its manifest and
  its installed name stay "YouPlay", so renaming can never strand an installed
  PWA or break the share target. It is stored per device and deliberately not
  synced — renaming on a phone should not rename a laptop.
- **New** and **Search**.
- **Object types**, from the registry in `src/lib/objects.ts`, each with its
  folders nested under it as a tree you can expand and collapse, and **Unfiled**
  at the end once anything is filed. Folders belong to a type, so they hang off
  it rather than sitting in a section of their own — with one type that is a
  small difference, with four it is the difference between a rail you can read
  and a flat list of everything you have ever made. The `+` on a type's row
  makes a folder in it. Counts are on hover rather than on the row, so the tree
  reads as names.
- **Tags**, most-used first, with counts. Clicking one filters the list.
- **Tags & folders**, **Profile & sync** and **Export / import** at the bottom.

It collapses on desktop (the panel button, remembered per device) and becomes a
drawer under 900px, behind the hamburger in the top bar. That top bar only exists
when the sidebar is not in the layout — on a phone always, on desktop only once
you have hidden it — so there is always a way back.

### Object types

`src/lib/objects.ts` is the registry of what this brain can hold. Only `weblink`
is in it today, but every screen reads the label, icon, colour and blurb from
there rather than hard-coding "Weblinks", and `TypeHeader` is written against the
registry entry rather than against links. The module is free of React and browser
imports, like the other pure modules, so it is exercised straight from the tests.

A type's page has three tabs:

| Tab | What it is |
| --- | --- |
| **Overview** | The type at a glance: totals, the oldest items in your queue, what you saved most recently, your tags, and where it all comes from. Everything on it is a way *into* the list. |
| **All** | The list, with the filter chips, sort and layout controls. |
| **New** | Uploads from YouTube channels you follow. Only offered once it can do something — an API key, or channels already followed. |

The tab is remembered per device and falls back to **All** if the remembered one
is no longer offered.

## The object page

Clicking anything opens its own page. This is where a saved link stops being a
bookmark: the fetched title and artwork are the smaller half of it, and the
note, the tags and the folder are yours.

It holds the artwork, an editable title, what the thing is and when you saved
it, a prominent **Open in {platform}** button, your note, its tags, its folder,
and a **Related** strip of everything sharing a tag or a folder with it —
which is how one saved thing leads to the next.

### What a card click does

A card is two controls, not one:

| Where you click | What happens |
| --- | --- |
| **The artwork** | Opens the link in YouTube, Spotify or wherever it came from. |
| **The text** | Opens the item's own page in the app. |

That split is why the card is a `<div>` holding two `<button>`s rather than one
button — HTML forbids nesting one inside another — and it is why the layout
rules are written against `.card`, `.thumb` and `.meta` rather than against the
element that happens to be clickable. Both buttons carry their own accessible
name: *Open "…" in YouTube* and *Open the page for "…"*.

Watching something and reading what you thought about it are two different
intentions, and a queue you have to detour through a page to play is a worse
queue. The hover overlay on the artwork is the play affordance for the first;
everything else on the card leads to the second.

**Everything saves as you leave the field.** There is no Save button, because
there is nothing to submit — a button would only invent a way to lose work by
navigating away. Tags and the folder commit the moment you change them; the
title and note commit on blur. The page is keyed on the item, so its draft state
can never belong to a different object than the one on screen.

**Back is a real Back.** Opening an object pushes a history entry, so the
phone's back gesture closes the page instead of closing the app, and the
in-app Back button and the system one are the same gesture. Objects stack:
open three through Related and Back walks you through them rather than dumping
you at the list. The page is layered *over* whichever section you were in, so
closing it returns you to the list, tag, folder or search you came from.

If the item goes away underneath you — deleted here, or removed on another
device and pulled in by a sync — the page closes itself through that same
gesture rather than sitting there showing nothing.

## Notes and tags

A note is the point of the whole thing: the link is what the internet says, the
note is what *you* say. Items carrying one show a small **Note** marker on the
card, with the text on hover. Notes are capped at 4000 characters so one runaway
paste cannot blow the `localStorage` quota and take the library down with it.

Title, note and tags can also be written in one go through `editItem`, which
saves them under a single `updatedAt` stamp — three separate writes would be
three stamps and three chances for a sync landing mid-edit to merge a
half-written item. An edit that changes nothing does not stamp one at all, so it
can never win a merge against a real edit made elsewhere.

Tags are stored on the item rather than in a registry of their own, so a tag
exists the moment something uses it and is gone when nothing does — no orphan
list to garbage-collect, and nothing extra for sync to reconcile.

- **Case is preserved, matching is not.** "Israel" should read as a name, not a
  slug. Typing `stocks` therefore lands on your existing `Stocks` rather than
  forking it. Where one tag has been spelled several ways, the sidebar shows the
  most common spelling — one stray `stocks` must not rename the `Stocks` you have
  used twenty times — while each card keeps the words you actually typed.
- **A leading `#` is accepted and dropped**, because that is how people type tags.
- **Twelve per item**, thirty-two characters each.
- **Colours are derived from the name**, so a tag looks the same on every device
  and every reload without storing anything. Hand-picked colours would be one
  more thing to sync, and a tag you have not opened yet would have none.

Tag filters are spelled `tag:Stocks` and are ordinary `FilterId`s, so the
remembered-filter preference and the stale-filter fallback work on them with no
special case. A slice you have opened names itself in a **context bar** above the
list, with its count and the two things you might want to do to it: **Rename**
and **Delete**. Both live there rather than in a menu on the sidebar row, because
that is where you can see what you are about to change — and on a phone there is
nowhere sensible to put a popover.

Renaming hands back the name that was actually *stored*, not the one you typed:
`#Thinking` is stored as `Thinking`, and pointing the filter at the raw text
would land on a tag nobody carries and an empty screen that reads like data loss.

In the dense **Rows** layout tags sit at the end of the line, before the hover
controls. On a phone they are dropped there along with the channel line — a chip
wide enough to read would leave the title as two letters, and the title is what
you scan a row by. The other three layouts keep them.

## Folders

Tags say what something is *about*; a folder says where it *lives*. An item
carries any number of tags and sits in at most one folder, and the two are meant
to be used together.

A folder is a **path**, `Work/Research`, nested up to four levels deep. Opening
one shows everything inside it *and* inside its subfolders — a folder you have to
open four times before you see anything is not a folder. Containment stops at a
separator, so `Work` never claims `Workshop`.

### Why there is no folder registry

The tree is **derived from the paths items carry**, exactly as the tag list is
derived from the tags in use. Nothing keeps a list of folders.

A registry would need its own synced table, its own RPCs and a SQL migration —
the followed-channels store already carries that wart, and a second one is worse
— plus orphan handling for a folder deleted while another device still has items
in it. Deriving the tree means folders sync for free inside the library that
already syncs, and a folder can never disagree with its contents.

The one thing derivation cannot express is an **empty** folder: a path no item
uses does not exist. Since "make a folder, then fill it" is a normal way to work,
`src/lib/draftfolders.ts` holds those — per device, not synced, and gone the
moment something real is filed there. An empty folder made on a phone appearing
on a laptop that has no use for it would be worse than the gap. They show in the
tree marked *empty*, and they never outvote a real folder's spelling.

### What the operations do

| Action | What happens |
| --- | --- |
| **File** | From the object page's folder picker, or `+ New folder` in it. |
| **New folder** | The `+` beside the sidebar heading. It exists here immediately and becomes real for every device as soon as something is filed in it. |
| **Rename** | From the context bar. Carries the subfolders along — renaming `Work` moves `Work/Research` to `Archive/Research`, or half the tree would be orphaned under a name that no longer exists. |
| **Delete** | Unfiles what was inside and keeps it. A folder is a place, not a container that owns its contents, so deleting one loses the filing rather than the things. It says so before you confirm: "Unfile 4 items?" |

Case is preserved and matching is case-insensitive, like tags, and the canonical
spelling is resolved **segment by segment down the tree** — otherwise an empty
`work/Ideas` would hang a child spelled `work` under a parent spelled `Work`, the
same folder wearing two names in one tree.

## Search

**Search** in the sidebar is a workspace-wide screen rather than a filter on one
list. With a single object type it looks much like the list, which is the point:
when a second type arrives, this is already the screen that spans them.

It searches **titles, channel names, your notes, your tags and the URL** — the
URL because the platforms that publish no title are exactly the ones whose
address is the only thing you might remember. The same matcher backs the search
box in the type header, so both boxes find the same things.

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
sight. To open on the full library instead, change `DEFAULT_FILTER` in
`src/lib/filters.ts` from `'unwatched'` to `'all'`.

## Sorting

The button in the type's toolbar toggles between **Newest first** (the default)
and **Oldest first**, sorting on when you saved the link. It sits in the tab row
beside the layout switcher rather than inside the chip strip, so it stays
reachable when the chips scroll — and it is hidden on **Overview**, which is not
a list and has nothing to sort. Items saved in the same millisecond break ties on their key, so
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

## Profile

**Profile & sync** at the foot of the sidebar — or the workspace name itself —
opens your profile. It gathers everything that is about *you* rather than about
browsing:
who you are signed in as, sync status and controls, what the library contains
(totals, queue progress, a YouTube/Spotify split, a breakdown by kind, and when
you first and last saved something), export/import, and the share-sheet setup
instructions — which were previously only visible while the library was empty.

The type header and its controls — search, tabs, filters, sort and layout — are
not rendered while the profile is open, since none of them apply to it.

## Links from anywhere

Save a link from any site. Fifteen platforms are recognised by name, and
anything else is kept as a plain link rather than refused — the app should never
lose something because it has not been taught about that site.

Recognised: YouTube, Spotify, X, Instagram, Facebook, Threads, TikTok, Reddit,
SoundCloud, Vimeo, Bluesky, Twitch, LinkedIn and Pinterest. Each one gets its
own colour, its own filter chip, and canonical URLs — so `twitter.com/…` and
`x.com/…` are the same item, as are `old.reddit.com` and `www.reddit.com`.

### Titles and artwork

A title can only be fetched where a platform publishes an oEmbed endpoint that
browsers are allowed to read. That split is not a matter of effort; it is what
each platform permits:

| | Platforms |
| --- | --- |
| Title, author and artwork are fetched | YouTube, Spotify, X, TikTok, Vimeo, SoundCloud, Bluesky |
| Nothing is readable from a browser | Instagram, Facebook, Threads, Reddit, Pinterest, Twitch, LinkedIn, other sites |

Instagram, Facebook and Threads need a Meta app token — their public endpoints
were retired in 2020. Reddit, Pinterest, Dailymotion, Mixcloud and Flickr answer
without CORS headers, so a browser may not read them, and Twitch's endpoint is
gone.

Those links are still saved, opened and organised normally; their title is
worked out from the URL instead. An Instagram link reads "Instagram post", a
Reddit link uses the slug already in its URL ("A very good cat · r/pics"), an X
profile becomes "@jack", and an unknown link uses its last path segment and
host. Since there is no artwork either, their cards show a tile in the
platform's colour rather than a thumbnail that would never load.

X and Bluesky are a special case: they return an empty title, with the post's
words inside the embed HTML, so the text is unpacked from there.

### Naming the rest

Two things cover the links whose titles cannot be fetched.

**Rename.** Every item has a rename control. Your title is kept: renaming counts
as an edit, so it is stamped and wins a sync merge, and it stops any later
lookup replacing your words — including one already in flight. This needs
nothing set up and works for every platform.

**Link previews (optional).** A page's title is readable by a *server* even
where a browser is refused, so where Supabase is configured the app asks
`link_preview` — see [`supabase-setup.sql`](supabase-setup.sql) — to fetch the
page and return just its title and image. That gives real names for Facebook
`/watch` links, GitHub, blogs and most ordinary websites. Instagram and Facebook
*page posts* still give nothing: they serve a login wall or an error to anyone
who is not signed in.

The trade to weigh: **the link is sent to your own Supabase project** so it can
be fetched from there. If you would rather that never happen, revoke it and
rely on renaming:

```sql
revoke execute on function public.link_preview(text) from anon;
```

The function is callable by anyone holding the public key, so it is deliberately
narrow: https only, no credentials in the URL, no non-default ports, and
private, loopback, link-local and cloud-metadata addresses refused — that last
one is what stops it reaching anything inside the network. It returns only the
extracted title and image, never the page. Titles are tidied on arrival, since
pages append their own site name and Facebook prefixes engagement counts.

Without Supabase, or before the SQL is run, nothing breaks: the request fails
and the URL-derived title stands.

### Tidying up links

Tracking parameters (`utm_*`, `fbclid`, `igshid`, `si` and friends) are stripped
before saving, so the same post shared from two different apps is one item
rather than several.

A YouTube channel URL is deliberately *not* claimed as a link: it is routed to
[the New feed](#new-from-channels) to be followed. That check has to run before
link parsing, or following a channel would quietly save it as an ordinary link.

## New from channels

Follow YouTube channels and the **New** chip shows their uploads from the last
2 days — switchable to 24 hours, 3 or 7 days — newest first, in whichever layout
you are using. Tap a video to watch it in YouTube; **+** saves it to your
library. Videos you have already saved show **Saved** or **Watched**.

Add a channel from **New → Add channel** with an `@handle`, a channel URL
(`/@handle`, `/channel/UC…`, `/user/…`, `/c/…`), or a link to any video from it.
Pasting or sharing a channel link anywhere in the app opens the same dialog,
which shows the channel before you commit. This is *follow*, not *subscribe*:
nothing changes on your YouTube account.

### Where the videos come from

The YouTube Data API v3, called straight from the browser — the API allows this
site's origin, so there is no proxy. YouTube's RSS feeds would avoid a key, but
they have been returning 404s widely through 2026.

| Action | Quota cost |
| --- | --- |
| Finding a channel | 1 unit (2 when found via one of its videos) |
| Refreshing a channel | 1 unit: its 50 newest uploads |

Each channel is refetched at most every 30 minutes and the feed is cached on the
device, so reopening the app is free and switching the window never costs a
call. The free quota is 10,000 units a day; 50 channels refreshed every 30
minutes around the clock is about 2,400.

Publish times come from `contentDetails.videoPublishedAt`. The similar-looking
`snippet.publishedAt` is when a video was *added to the playlist*, and would make
a re-added old video look brand new. Private and deleted placeholders are
skipped.

Known limits:

- Shorts are included: the uploads playlist does not tell them apart.
- A refresh reads a channel's 50 newest uploads; a channel posting more than
  that inside your window would be cut off.
- Scheduled premieres are held back until they start.

### Setting up the key

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project.
2. **APIs & Services → Library → YouTube Data API v3 → Enable.**
3. **Credentials → Create credentials → API key.**
4. Restrict it. *Website restrictions:* `https://shaharkalderon.github.io/*` and
   `http://localhost:5173/*`. *API restrictions:* YouTube Data API v3 only.
5. Add it as the repo Variable `YOUTUBE_API_KEY` and re-run the deploy; for local
   development set `VITE_YOUTUBE_API_KEY` in `.env`.

The key ships in the public bundle, like the Supabase anon key. The restrictions
are what stop other sites spending its quota. If it is ever abused, delete it in
Google Cloud and make another.

Until a key exists, the New chip does not appear and the rest of the app is
unchanged.

### Syncing followed channels

Followed channels sync with your sync code, under the same rules as the library:
the newest edit wins, and unfollowing leaves a tombstone so it survives a sync.
They use their own column and functions, so **re-run
[`supabase-setup.sql`](supabase-setup.sql) once** — it is safe to run again.
Until then the library keeps syncing normally and channels stay on each device.

## Sync across devices

No accounts, no email, no passwords. A library is identified by an unguessable
**sync code**, and every device holding that code shares one library.

1. Profile → **Turn on sync**. That generates your code.
2. **Copy setup link** and open it on your other devices — one tap and they
   join. Or paste the code in by hand.

### How it is kept private

The code is a *capability*, like a private share link: whoever has it can read
and write that library, and without it the server hands over nothing.

The table itself is not reachable with the public key. Row level security is on
with **no policies**, which denies direct access to everyone, and the anon role
has its table grants revoked. The only way in is two security-definer functions
that require the exact id:

```
library_pull(p_id uuid)            -> the library, or [] if unknown
library_push(p_id uuid, p_items)   -> writes it, rejecting non-array input
```

So the public key can never list, enumerate or scan libraries — only address one
it already knows. Guessing a v4 UUID is a 2^122 search, which is not a practical
attack.

The honest trade: **there is no second factor.** Anyone who obtains your code
has your library, and you cannot revoke it short of turning sync on again to get
a new one. Do not post it publicly. If you want per-person accounts instead, that
needs real login — this design deliberately swaps that for zero setup.

### How conflicts are resolved

Merge-based, not last-device-wins, so two devices edited while apart reconcile
rather than one clobbering the other:

- Every change stamps `updatedAt`; the newer edit wins per item.
- Deletes leave **tombstones**. Without them a delete on one device is silently
  undone by the next device that syncs an older copy back. Pruned after 90 days.
- `addedAt` keeps the earlier value: when you first saved a link is a fact about
  the past, not something a later sync should rewrite.
- Metadata is a cache, not intent — a placeholder title never overwrites one
  that resolved on another device.
- The merge is commutative, so it does not matter which device syncs first.

Sync runs on load, on tab focus, and every five minutes. A write only happens
when the merge actually differs from what the server had, so idle devices do not
ping-pong.

### Setting it up

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase-setup.sql`](supabase-setup.sql).
3. From **Project Settings → API**, copy the project URL and the `anon` key.
4. Add them as repo **Variables** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) and
   re-run the deploy workflow. For local dev, copy `.env.example` to `.env`.

The `anon` key is safe to publish — it is designed to ship in client code and
grants only what the schema above allows. Never put the `service_role` key here.

## Importing from Capacities

```bash
node scripts/import-capacities.ts "<export folder>" youplay-import.json
```

Point it at the folder holding `Weblinks/`, `Books/`, `Quotes/` and the rest.
It reads `Weblinks/*.md` and writes a file you load through **Export / import**
in the app. Only weblinks are read; the other object types have no home here yet.

| Capacities | YouPlay |
| --- | --- |
| `url` | The link, re-parsed into its canonical form |
| `title` | The title — unless it is scraper junk, see below |
| `description` | Your note, unless it is boilerplate, see below |
| `tags` | Tags |
| `collections` | The folder. Capacities allows several; the first becomes the folder and the rest become tags, so a second membership is still findable |
| `createdAt` | When you saved it |
| `previewImage` | Dropped, see below |

Three judgement calls are worth knowing about:

- **Junk titles are thrown away.** The export has 27 items called "- YouTube",
  ten called "Untitled" and a handful called "Login • Instagram" — all scraper
  misses. Dropping them lets the app fetch the real title on first load, and a
  placeholder worked out from the URL beats a name that is wrong.
- **Boilerplate descriptions are thrown away.** "Enjoy the videos and music you
  love…" is on every YouTube link in the export; it describes the *platform*,
  not the item, and 200 identical notes would make the Note marker meaningless.
  The rule is frequency rather than a list of known blurbs: a description
  appearing on three or more items is about the site, not the thing.
- **Preview images are dropped.** They are presigned S3 URLs with a 12-hour
  expiry, so importing them would fill the library with tiles that go blank the
  same day. Leaving the thumbnail empty marks the item unresolved instead, and
  the app fetches a real, durable thumbnail on first load.

Nothing in the export is trusted beyond the link itself. Every URL goes back
through the app's own parser, so an imported item is one the app could have
created by saving that link, and two spellings of the same link collapse into
one entry exactly as they would on paste.

Items whose metadata cannot be fetched — a deleted video, one with embedding
turned off, a private one — keep whatever title the export had and are retried
on each load, since a video can come back.

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
- The service worker registers and activates on the live site, scoped to
  `/youplay/`. It does **not** register over plain `http://localhost` in some
  embedded browsers — that is an environment limit, not a code problem.
- Sync is optional and must be configured; until then the library is per-device
  and export/import is the manual substitute.

## Layout

```
src/lib/links.ts      URL → canonical {platform, kind, id, url, appUri}
src/lib/metadata.ts   oEmbed lookups + graceful fallbacks
src/lib/store.ts      localStorage library, dedupe, retry
src/lib/layout.ts     grid / compact / list definitions
src/lib/sort.ts       sort order + comparator (pure, tested)
src/lib/filters.ts    filter definitions + predicates, tag filters (pure, tested)
src/lib/objects.ts    the object type registry (pure, tested)
src/lib/tags.ts       tag cleaning, counting and colours (pure, tested)
src/lib/folders.ts    folder paths, the derived tree, containment (pure, tested)
src/lib/draftfolders.ts  empty folders, per device and unsynced
src/lib/navigation.ts    sections, and the object stack wired to browser history
src/lib/search.ts     what a query is matched against (pure, tested)
src/lib/preferences.ts  localStorage-backed layout, sort, tab, sidebar and workspace stores
src/lib/time.ts       relative + absolute timestamps
src/lib/transfer.ts   export envelope + defensive import parsing
src/lib/sync.ts       merge, tombstones, pruning (pure, tested)
src/lib/stats.ts      profile figures (pure, tested)
src/lib/remote.ts       pull / merge / push
src/lib/synccode.ts     sync code parsing and storage (pure, tested)
src/lib/syncsession.ts  code ownership and sync scheduling
src/lib/supabase.ts     RPC helper and config detection
src/lib/platforms.ts    per-platform parsing, colours and oEmbed endpoints
src/lib/preview.ts      server-side title lookup for links browsers cannot read
src/lib/youtube.ts      YouTube API client and response parsing (parsers tested)
src/lib/channels.ts     followed channels: storage, follow and unfollow
src/lib/feed.ts         fetching, caching and the feed window
src/lib/share.ts      share-target / ?link= intake
src/lib/open.ts       hand-off back to YouTube / Spotify
scripts/make-icons.mjs  dependency-free PNG icon generator
```
