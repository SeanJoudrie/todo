# Working on this repo

A private, single-user task app. One user, one device, no accounts. The spec it
was built from is `PROMPT.md`; `README.md` is the user-facing description.

## NEVER send a Claude artifact

The owner cannot open artifacts on their phone. They have asked, in the
strongest terms, never to be sent one again. **The app lives on GitHub Pages.**
When they say "link me", they mean a github.com URL — nothing else.

- **The app:** https://seanjoudrie.github.io/todo/
- **The repo:** https://github.com/SeanJoudrie/todo

## Shipping — do all of this, every time

```sh
npm test                       # unit tests
npm run build                  # typecheck + production build
npm run preview &              # then, against the built app:
npm run e2e                    # browser checks, then the service-worker check
git push origin main           # this is the deploy
```

Pushing to `main` **is** the deploy: `.github/workflows/deploy.yml` runs the
tests, builds, and publishes to Pages. Confirm the run went green before telling
the owner it shipped — a red run means they are still on the old build. Then
give them https://seanjoudrie.github.io/todo/

`npm run build:artifact` still exists for a single self-contained `.html`, but
do not publish it as an artifact. It is only useful for handing over a file.

`CHROME_PATH` may need setting for `npm run e2e` if Playwright can't find a
browser.

## The service worker, and "I don't see it"

If the owner says a change isn't there and describes something from an *earlier*
build as present, he is being served a stale copy — believe him and check the
worker before re-reading the feature code.

`public/sw.js` was stale-while-revalidate for everything, so every fresh open
served the previous build and a deploy only landed on the visit after. He spent
days looking at an app two deploys behind while being told things had shipped.
Now: the document is **network-first**, and only content-hashed `/assets/` files
are cache-first, because their names change whenever their contents do.

- **Never test this with `page.reload()`.** A reload revalidates. He taps a
  link, which is a fresh navigation. The check that missed this bug used a
  reload and passed the whole time. `scripts/sw-check.mjs` opens a new page
  every time, and runs `src/lib/sw-register.ts` as its real source rather than
  a copy that could drift.
- Replacing the worker isn't enough on its own — the visit that installs the
  replacement is still served by the old one. `registerServiceWorker` reloads
  once on `controllerchange`, guarded against a loop, so the new build arrives
  without him needing to know to open it twice. It takes about three seconds.
- Settings shows `Build <date> · <sha>`, stamped in by `vite.config.ts`. Ask him
  for it rather than guessing which build he is on.
- `npm run e2e:sw` is also in CI, because a broken worker means he silently
  stops receiving everything else.

## Changing the shipped task list

The starting list lives in `src/lib/seed.ts`. **Bump `SEED_VERSION` whenever it
changes**, or the owner's app will never pick the new list up.

`shouldReseed` only replaces a list nobody has touched — every task still marked
`seed`, nothing completed, nothing edited, nothing added. Once the list has been
used it belongs to the owner and is never overwritten. Do not weaken this: a
wrong `true` there silently destroys real work. When it won't fire because the
list has been used, hand over an import JSON instead.

## Rules the tests enforce (don't break them)

- Every shipped task has a description, and every blocked task says what is
  blocking it.
- The list averages >2 tags per task, with at most 3 single-tagged.
- The parser never returns an empty tag list — it falls back to `unsorted`
  rather than leaving a task invisible to every filter.
- `waiting` is not `done`. It must stay visible in All, Tags, and Today's
  blocked section. It once vanished from every view; don't let that return.

## Storage

- Tasks → `localStorage`, synchronous and small.
- Photos → IndexedDB, keyed by id; tasks hold only the ids. One phone photo
  would consume the entire `localStorage` budget, which is why they're split.
- The Anthropic API key is stored outside `AppState` on purpose, so it can never
  ride along in an exported backup.

## Privacy

The task data is the owner's real life — benefits, housing, finances, medical.
They have said they don't mind it being public, but don't widen that: keep
generated exports out of git (`exports/` is ignored).
