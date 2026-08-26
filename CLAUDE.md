# Working on this repo

A private, single-user task app. One user, one device, no accounts. The spec it
was built from is `PROMPT.md`; `README.md` is the user-facing description.

## Shipping — do all of this, every time

A change is not delivered until the **live app** has it. Pushing to git alone
does not count: the owner uses the published page, not the repo.

```sh
npm test                       # unit tests
npm run build                  # typecheck + production build
npm run preview &              # then, against the built app:
npm run e2e                    # browser checks of the real flows
npm run build:artifact         # single self-contained page
# publish dist-artifact/app.html to the SAME artifact URL (never a new one)
git push origin main
```

Then give the owner the link. Both links, when either changed:

- Live app: https://claude.ai/code/artifact/be25dde2-5ce1-4ef3-911a-d46ad68f9ba2
- Source: https://github.com/SeanJoudrie/todo

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
