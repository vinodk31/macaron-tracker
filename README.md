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
- **Two kinds of access.** The owner signs in with `APP_PASSWORD` and gets the whole app. Staff sign in with a 5-digit PIN (issued in Setup) and only ever see freezer counts, their own shifts and their own pay. The session cookie carries the role, signed with `AUTH_SECRET`.
- **Permissions are enforced server-side**, not in the UI. `/api/state` filters the payload down to the signed-in employee before it leaves the server, and rewrites of settings, other people's shifts or any payment are dropped from staff writes rather than trusted. Hiding things in the browser alone would leave the data one devtools glance away.
- **Login is rate limited.** A 5-digit PIN is only 90,000 possibilities, so repeated failures from one address lock it out with escalating backoff (counters live in Postgres, since serverless instances share no memory).

## Tabs

- **Day** — date navigation, freezer counts with a comparison-period picker (yesterday/week/month/year), hours, and a note.
- **Week** — stat tiles, sold-per-day bar chart, per-flavor ranking, and **Payroll**: what each person earned that week, a Mark paid button per person, and the running outstanding balance (or "All clear").
- **Month** — the same stats plus **cost of goods sold**: wages actually paid out during the month per person, ingredient cost from macarons sold, and the COGS total with cost per macaron.
- **Setup** — shop name, weekly store hours, prep/close buffers, staff & rates, flavor list, and a two-step data wipe.
