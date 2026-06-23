# Spotify integration for Album of the Day — brainstorm

This is a design sketch, not a committed plan. The goal: make the
**Album of the Day** feature (`src/components/AlbumOfTheDay.tsx`,
`albums` table in `src/lib/db/schema.ts`) richer by hooking into Spotify —
cover art, real catalog data, easy playback, and ideally
auto-detecting when an album was actually listened to.

## What we have today

- `albums` rows are free-text `artist` + `title`, a `position` (queue order),
  an optional `listenedOn` date, `rating`, and `note`.
- Adding an album = typing artist + title by hand. No validation, no art.
- "Mark as listened" is a manual button.

## Ideas, roughly by value vs. effort

### 1. Catalog search + cover art (highest value, lowest effort)
Replace the freehand add form with a search box that hits Spotify's
catalog. The user types, sees real albums (with artwork, artist, year),
and picks one. We then store the canonical metadata.

- **Auth:** Spotify **Client Credentials** flow — only needs a
  `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, *no per-user OAuth*. One
  app token, refreshed server-side. Much simpler than the Strava OAuth we
  already do.
- **Schema additions** to `albums`: `spotifyId`, `imageUrl`,
  `releaseYear`, `spotifyUrl` (all nullable, so existing rows still work).
- **New code:**
  - `src/lib/spotify/client.ts` — token fetch/cache + `searchAlbums(q)`,
    mirroring the shape of `src/lib/strava/client.ts`.
  - `src/app/api/spotify/search/route.ts` — guarded with
    `requireUser().catch(() => null)` like every other route; proxies the
    search so the secret never reaches the client.
  - `AlbumOfTheDay` add form → typeahead that POSTs the chosen album's
    metadata to the existing `/api/albums`.
- **UI payoff:** show artwork in the Today card, the Up-next list, and
  Recently-listened. Big visual upgrade for the dashboard remodel.

### 2. Playback shortcuts
With `spotifyUrl` stored, add:
- A "Play on Spotify" button (deep link `spotify:album:<id>` with web
  fallback `https://open.spotify.com/album/<id>`).
- Optionally an embedded player (`<iframe src="https://open.spotify.com/embed/album/<id>">`)
  inside the Today card — zero extra auth, instant preview.

### 3. Auto-mark "listened" (highest value, higher effort)
Detect that you actually played today's album and flip `listenedOn`
automatically.

- **Auth:** needs per-user **Authorization Code** OAuth (PKCE), scopes
  `user-read-recently-played` (+ `user-read-currently-playing`). This is
  the same pattern as Strava: store `accessToken` / `refreshToken` /
  `tokenExpiresAt`. Put them in a new `spotify_accounts` table (one-to-one
  with `users`) rather than bloating `users`.
- **Mechanism:** on dashboard load or a "Sync Spotify" action (parallel to
  the existing Strava sync), call `/me/player/recently-played`, and if
  today's queued album's `spotifyId` appears, set `listenedOn = today`.
- **Caveat:** recently-played only returns the last 50 tracks / ~24h, so
  this is best-effort and should run opportunistically, not as the source
  of truth. Keep the manual button as the fallback.

### 4. Import from your library / playlists
One-off "import" that pulls your Spotify **saved albums**
(`/me/albums`) or a chosen playlist into the queue, so you don't have to
build it by hand. Needs the same user OAuth as #3, scope
`user-library-read`. Nice-to-have once #1 and #3 exist.

## Suggested phasing

1. **Phase 1 — Search + art + play link.** Client-credentials only,
   additive schema columns. Delivers most of the visible value with the
   least plumbing and no per-user login. Do this alongside the layout
   remodel.
2. **Phase 2 — User OAuth + auto-listened.** Adds `spotify_accounts`,
   the OAuth dance, and a sync step. Optional.
3. **Phase 3 — Library/playlist import.** Convenience on top of Phase 2.

## Open questions
- Single-user app (per `CLAUDE.md`), so token storage can stay simple.
- Do we want the embedded player (richer, but heavier card) or just a
  link (lighter)? Leaning link + artwork for the dashboard's density.
- Env/secrets: add `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, and for
  Phase 2 a `SPOTIFY_REDIRECT_URI`.
