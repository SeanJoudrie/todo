# todo

A private, single-user task app. Not a product — a tool for one person, built to answer one
question well: **what should I do today?**

The full spec it was built from is in [`PROMPT.md`](./PROMPT.md).

## What it does

- **Capture by voice or text.** Tap the box, hit the mic on your keyboard, talk. Dates, durations
  and tags get pulled out of what you said and shown as chips you can tap to undo. Paste or dictate
  several lines and you get one task per line.
- **Two kinds of dates.** A hard deadline (real consequence if missed) and a soft target (when you
  want it done so you're not scrambling). The planner works to the soft one; the hard one shows in
  red.
- **Rough duration guesses.** "About 2–3 hours" is a perfectly good answer. So is not answering —
  the planner assumes ~45 minutes and marks the guess.
- **"What should I do today?"** Tell it how much time you have, roughly what kind of energy, and
  optionally a focus. It returns an ordered run with clock times, and every line says why it's
  there. Deterministic and offline — no API key, no waiting.
- **Completed work stays visible** at the bottom of the list, grouped by day.

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
```

## Checks

```sh
npm test             # unit tests for the parser and planner
npm run build        # typecheck + production build
npm run lint

npm run preview &    # then, against the built app:
npm run e2e          # browser smoke test of the real flows
```

`e2e` needs a Chromium; set `CHROME_PATH` if Playwright can't find one on its own.

## Deploying

`npm run build` writes a static `dist/`. Drop it on any static host, open it on your phone, and use
"Add to Home Screen" — it installs as a PWA and works offline.

## Your data

Everything lives in this browser's `localStorage` and goes nowhere else. There's no account, no
server, no sync. **Export a JSON backup now and then** (Settings → export) — it's the only copy.
The app also keeps the last 10 auto-saves, restorable from Settings.
