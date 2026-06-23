# Project notes for Claude

## Workflow
- This is a personal project with a single developer/user (the repo owner). There
  are no other collaborators, so we work directly on `main` — feature branches can
  be merged straight back into `main` without PRs or review.

## Stack
- Next.js 16 (App Router) + React 19, Drizzle ORM + Postgres, Tailwind CSS v4.
- JWT session cookie (jose); Strava OAuth for auth.
- Schema lives in `src/lib/db/schema.ts`; after schema changes run `npm run db:push`.

## Conventions
- API routes guard with `requireUser().catch(() => null)` and return 401 when unauthed.
- Client feature components take `initial*` data as props and update local state
  optimistically while PATCH/POST/DELETE-ing to `/api/*` (see `TodoList`, `AlbumOfTheDay`).
