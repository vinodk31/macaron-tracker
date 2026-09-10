# Macaron Tracker

A mobile-first inventory and staff-hours tracker for a mall macaron kiosk, built with Next.js (App Router, JavaScript).

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — designed for a phone-width viewport (~380px).

## How it works

- **Inventory is a freezer count.** Each day you enter one integer per flavor: what's physically in the freezer. There's no "sold" field — sold and restocked are derived by comparing each day's count to the previous *recorded* count for that flavor (days with no count are skipped, not treated as zero).
- **Hours auto-fill.** Every day gets a shift derived from the store's weekday hours plus prep/close-out buffers, with no data entry needed. Editing the default hours in Setup retroactively updates every day that hasn't been individually overridden.
- **Storage** lives entirely behind `lib/storage.js` (`load()`/`save()`), currently backed by `localStorage`. A commented-out `/api/state` fetch version is included for swapping to a real backend later without touching any UI code.

## Tabs

- **Day** — date navigation, freezer counts with a comparison-period picker (yesterday/week/month/year), hours, and a note.
- **Week** / **Month** — stat tiles (units sold, freezer level, scheduled hours, labor cost), a sold-per-day bar chart, and a per-flavor ranking.
- **Setup** — shop name, weekly store hours, prep/close buffers, staff & rates, flavor list, and a two-step data wipe.
