# Macaron Tracker

A mobile-first inventory and staff-hours tracker for a mall macaron kiosk, built with Next.js (App Router, JavaScript).

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — designed for a phone-width viewport (~380px).

## Environment variables

All three are required, locally in `.env.local` and in the Vercel project settings:

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Set automatically when you add Neon from the Vercel Marketplace. |
| `APP_PASSWORD` | The password for the sign-in screen. |
| `AUTH_SECRET` | Random string used to sign the session cookie. Generate with `openssl rand -hex 32`. |

The `app_state` table is created automatically on first use — there's no migration step.

## How it works

- **Inventory is a freezer count.** Each day you enter one integer per flavor: what's physically in the freezer. There's no "sold" field — sold and restocked are derived by comparing each day's count to the previous *recorded* count for that flavor (days with no count are skipped, not treated as zero).
- **Hours auto-fill.** Every day gets a shift derived from the store's weekday hours plus prep/close-out buffers, with no data entry needed. Editing the default hours in Setup retroactively updates every day that hasn't been individually overridden.
- **Storage** lives entirely behind `lib/storage.js` (`load()`/`save()`), which talks to `/api/state`. The whole `{ settings, days }` object is one JSONB row in Postgres, so the API is just a read and a write. Data entered before the migration is picked up from `localStorage` once and uploaded, so nothing is lost.
- **Access** is gated by a password. `/api/login` checks it against `APP_PASSWORD` and sets a signed, HttpOnly session cookie; `/api/state` returns 401 without it and the UI shows the sign-in screen.

## Tabs

- **Day** — date navigation, freezer counts with a comparison-period picker (yesterday/week/month/year), hours, and a note.
- **Week** / **Month** — stat tiles (units sold, freezer level, scheduled hours, labor cost), a sold-per-day bar chart, and a per-flavor ranking.
- **Setup** — shop name, weekly store hours, prep/close buffers, staff & rates, flavor list, and a two-step data wipe.
