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
npm run e2e                    # browser checks of the real flows
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
