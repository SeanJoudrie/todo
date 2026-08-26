# todo

**Open it:** https://seanjoudrie.github.io/todo/
**Source:** https://github.com/SeanJoudrie/todo/tree/claude/personal-todo-app-prompt-o6gw5i

Add the link to your phone's home screen and it opens like an app.

A private, single-user task app. Not a product — a tool for one person, built to answer one
question well: **what should I do today?**

The full spec it was built from is in [`PROMPT.md`](./PROMPT.md).

## What it does

- **Dump it, and it sorts.** Hit "Dump it", talk for as long as you want, and it breaks the ramble
  into separate tasks with tags, dates and durations already guessed. *"ok so I have to do an army
  presentation I think Tuesday I don't know I'll get back to it, and I also need to take the truck
  in probably 2-3 hours"* becomes two clean tasks. It always guesses a tag rather than leaving one
  blank, marks anything you hedged on as **unsure**, and shows you what it heard so you can check
  its work before anything gets added.
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
- **Photos on any task.** Open a task and hit the camera — snap one or pick from the library. Good
  for the cracked windshield, a form you need to remember, a receipt. They're shrunk on the way in
  so a hundred of them still cost less than one raw phone photo, and they ride along in your backup.
- **Completed work stays visible** at the bottom of the list, grouped by day.

Light, monospaced where it counts, and built to be read one-handed on a phone.

### Sharper organizing (optional)

Paste an Anthropic API key into Settings and "Dump it" uses Claude to sort your dumps instead of the
built-in parser — better at messy, run-on speech. Without a key it still works, just more literally,
and if the API is unreachable it silently falls back rather than failing. The key stays in your
browser, goes straight to Anthropic, and is deliberately kept out of your JSON backups.

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

## Where it's running

Live at **https://seanjoudrie.github.io/todo/** — every push to `main` runs the tests, builds, and
republishes it (`.github/workflows/deploy.yml`). Add it to your phone's home screen and it installs
as a PWA that works offline.

**Your tasks live per URL**, in that browser's own storage. To move a list somewhere else:
Settings → **copy backup** in the old one, **paste a backup** in the new one.

## Deploying anywhere else

`npm run build` writes a static `dist/` for any host. `npm run build:single` writes a single
self-contained `dist-single/index.html` if you'd rather have one file.

## Your data

Tasks live in this browser's `localStorage`; photos live in IndexedDB alongside them. Nothing goes
anywhere else. There's no account, no
server, no sync. **Export a JSON backup now and then** (Settings → export) — it's the only copy.
The app also keeps the last 10 auto-saves, restorable from Settings.
