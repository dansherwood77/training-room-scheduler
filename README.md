# Training rooms

A small scheduler for booking training rooms. The week and the month show the same sessions. Drag across a day to book one. A room can't hold two sessions at once. Back-to-back is fine, and a session can cross midnight.

## Setup

You need Node.js 22 or newer.

```bash
npm install
npx playwright install chromium
npm test
npm run test:e2e
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` starts two processes:

- the Next.js app on port 3000
- the API on port 4000

The app proxies `/api` to the API. Bookings are stored in `server/data/scheduler.sqlite`, so they survive a restart. The first launch seeds a week of sample sessions. To get a fresh week, stop the server and delete that file (and the `-wal` / `-shm` siblings), then start again.

Times are shown in `America/Los_Angeles`.

## Try this

- Drag down a day. The yellow band snaps to 15 minutes. Drag past the bottom of the column and the session continues into the next day.
- Click a day for a one-hour block, then name it in the sheet.
- Book Sun Room for 9:00–10:00 on a day that already has Morning Flow. The sheet should say which session is in the way.
- Book Sun Room from 12:00 onward on the sample Sunday. Skills Lab ends at 12:00, so that one is allowed.
- Switch Week and Month. The session you were looking at moves between the two views.
- Edit opens in a sheet. Cancel asks before it frees the room.
- Cancel a room asks, and tells you how many bookings go with it.

## Layout

- `client` is Next.js (React, TypeScript). Motion handles the view change, the drag band, and the sheet content. Radix handles the dialog.
- `server` is Express and `better-sqlite3`.
- `shared` is the overlap rule, the time math, and the refusal sentences. Vitest covers those, the API, and the drag math. Playwright runs the week, day, and month in a browser against a throwaway database.

The rule is a half-open range: a booking overlaps another when `start < otherEnd` and `otherStart < end`. Touching endpoints do not overlap.
