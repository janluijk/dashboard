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

## Sharing one Strava app with buurtheld

This project deploys separately from `../buurtheld` but they share **one Strava API app** and **one Postgres database**.

- Strava callback domain must match both deploys' host. Set it to your root domain (e.g. `yourdomain.com`) so both `dashboard.yourdomain.com` and `buurtheld.yourdomain.com` are accepted. Each app keeps its own full `STRAVA_REDIRECT_URI` pointing to its own `/api/auth/callback`.
- Both projects point at the same `DATABASE_URL`. The dashboard's `schema.ts` knows about buurtheld's tables (segments, favorites, etc.) so `drizzle-kit push` from either side is safe — it only adds the new dashboard tables on first run.
- Sessions are not shared (each app has its own JWT cookie). After Strava login on either app you're recognized as the same user row because both look up users by `strava_athlete_id`.
- Set `NEXT_PUBLIC_BUURTHELD_URL` in dashboard env → sidebar link appears.
- Set `NEXT_PUBLIC_DASHBOARD_URL` in buurtheld env → "← Dashboard" link appears top-left.

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
