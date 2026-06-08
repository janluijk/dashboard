# Personal Dashboard

Track weekly mileage, workout time, study sessions, and todos in one place.
Strava activities are synced into Postgres; study sessions come from a built-in timer (or manual entry).

## Stack

- Next.js 16 (App Router) + React 19
- Drizzle ORM + Postgres
- Tailwind CSS v4
- JWT session cookie (jose)
- Deploy: Vercel (Neon Postgres via Marketplace recommended)

## Setup

1. `npm install`
2. Create a Strava API app at https://www.strava.com/settings/api
   - Authorization Callback Domain: `localhost` (and your prod domain later)
3. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Postgres connection string
   - `SESSION_SECRET` — long random string
   - `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`
   - `STRAVA_REDIRECT_URI` — `http://localhost:3000/api/auth/callback` for dev
4. `npm run db:push` to create tables
5. `npm run dev`

## Buurtheld (Strava Local Legend tracker)

The Buurtheld feature lives in this same app under `/buurtheld/*` (Explore, Favorites) with its API under `/api/segments` and `/api/favorites`. It was previously a separate repo/deploy; it is now consolidated here so there is a single codebase, single deploy, and single `schema.ts` owning all tables. It reuses the same Strava OAuth and `users` table — you sign in once and are recognized by `strava_athlete_id`.

## Deploy to Vercel

1. Push to GitHub.
2. Import in Vercel; add a Neon Postgres integration (Marketplace) — provisions `DATABASE_URL`.
3. Set `SESSION_SECRET`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REDIRECT_URI` (your prod `/api/auth/callback`) in project env vars.
4. Update your Strava app's authorized callback domain to your prod host.
5. After first deploy: run `npm run db:push` against the prod DB once (or use `db:migrate` with generated SQL).

## Notes on Coros

Coros doesn't offer a public/self-serve API — the Coros Open API is partner-only.
Practical workaround: Coros watches sync automatically to Strava, so this dashboard already gets Coros data via the Strava sync.
Sleep / recovery scores are not exposed by Strava; if you want them, manual entry or scraping from the Coros web app is your only option.

## Features

- Weekly stats: mileage (running), workout time (all activities), study time
- Weekly goals with progress bars (editable inline)
- Study timer (live) + manual entry
- Todo list
- 12-week heatmap combining workouts + study
- Sync Strava button (last 90 days, paginated, token auto-refresh)

## Ideas to add next

- Habit tracker (daily checkboxes)
- Weight / body metrics line chart
- Daily journal notes
- Weekly summary (this week vs last)
- Activity-type breakdown chart (run / ride / swim / strength)
