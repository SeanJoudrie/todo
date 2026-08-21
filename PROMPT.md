# Build Prompt: Personal Task System

> This is the spec/prompt for building the app. Not the app. Edit freely, then say "build it."

---

## 0. The brief

Build me a private, single-user task app that I can dump my entire life into by voice, and that
can answer one question well: **"what should I do today?"**

I'm not building a product. There is no signup, no onboarding, no marketing page, no other users,
no sharing, no team features, no monetization, no analytics. It's a tool for exactly one person.
Optimize for *my* speed of capture and *my* trust in the output, not for generality.

The reason it needs to exist: my obligations come from four or five totally different worlds —
Army/OCS, VA, career, house, personal life — and they don't live in the same place. Some have hard
deadlines with consequences. Some are "eventually, when I have a free Saturday." I need one list
that holds all of it and can tell me what to actually do with a random free Tuesday afternoon.

---

## 1. Non-goals (do not build these)

- Accounts, auth, multi-user, permissions, sharing, collaboration
- Email/SMS/push notifications (v1 — revisit later)
- Calendar sync (v1)
- Gamification: streaks, points, badges, confetti storms
- Kanban boards, Gantt charts, "workspaces," nested projects five levels deep
- Any setting I'd have to configure before the app is usable
- An empty-state that lectures me about productivity methodology

---

## 2. Platform & stack

**Assumptions (confirm before building — see §12):**

- **Mobile-first web app**, installable as a PWA so it sits on my home screen like a real app.
  Must be excellent on an iPhone in one hand, and merely fine on a laptop.
- **Voice input = the phone keyboard's own dictation button.** Do NOT build a custom speech
  recognition layer. Every text input in this app must be a plain, focusable, multi-line-tolerant
  field so that tapping the mic on the iOS/Android keyboard Just Works. The app's job is to not get
  in the way: no fancy inputs, no rich-text editors, no autocomplete that fights dictation, no
  auto-submit on pause.
- **Stack:** React + TypeScript + Vite + Tailwind. Minimal dependencies.
- **Storage:** local-first. All reads/writes hit local state instantly; the app works fully offline
  on a plane. Sync (if any) is a background concern, never a blocking one.
- **Hosting:** static build, deployable anywhere (Vercel/Netlify/Cloudflare Pages/`file://`).

---

## 3. Data model

Everything except `title` is optional. **The app must be fully usable by someone who only ever
types a title and never fills in another field.** Every optional field is a bonus that makes the
planner smarter, never a tax on capture.

```ts
type Task = {
  id: string
  title: string                    // required. everything else is optional.
  notes?: string                   // free text. voice dumps land here too.

  tags: string[]                   // multi-tag. see §4.
  status: 'open' | 'done' | 'waiting' | 'someday'

  // TWO kinds of dates — this distinction matters a lot to me:
  dueDate?: string        // HARD deadline. real-world consequence if missed.
  targetDate?: string     // SOFT date. when I want it done by, to not be scrambling.
  // Example: I teach the UCMJ class MONDAY (dueDate) but want it built by SUNDAY (targetDate).
  // The planner works to targetDate; the UI shows the hard deadline in red.

  estimateMinutes?: number         // rough guess. see §5.
  estimateConfidence?: 'guess' | 'known'   // "2-3 hours" is a guess. "10 min call" is known.

  priority: 'low' | 'normal' | 'high' | 'critical'   // default 'normal'
  pinned?: boolean                 // force to the top of everything
  effort?: 'light' | 'normal' | 'deep'   // can I do this tired? deep = needs a real brain.
  context?: ('home'|'out'|'phone'|'computer'|'business-hours')[]  // planner uses these

  subtasks?: { id: string; title: string; done: boolean }[]

  createdAt: string
  updatedAt: string
  completedAt?: string
  snoozedUntil?: string            // "not today" from the planner sets this
}
```

**Design rules:**
- A task with only a title is a first-class citizen, not an incomplete record.
- No required categorization. Untagged tasks show up in "Everything" and still get planned.
- Unknown duration is fine and must never break the planner (§6 says how it's handled).

---

## 4. Tags

Multi-select, user-editable, color-coded, freely creatable. Ship with these defaults:

| Tag | For |
|---|---|
| `army` | OCS, drill, UCMJ class, PT, records, uniform, schools |
| `va` | claims, appointments, paperwork, benefits — the "eventually" pile |
| `house` | buying a house, the move, anything property |
| `career` | LinkedIn, resume, networking, job search, certs |
| `current-job` | day-job obligations |
| `growth` | personal development, learning, reading, skills |
| `fun` | things I actually want to do |
| `people` | family, friends, calls, hangouts |
| `health` | appointments, fitness, food, sleep |
| `home` | chores, cleaning, laundry, repairs |
| `admin` | bills, DMV, insurance, the boring load-bearing stuff |

Tags must be: creatable inline while typing a task, renameable, mergeable, and deletable without
destroying the tasks that carry them.

---

## 5. Capture — the single most important feature

If capture is slow, I stop using the app and the whole thing was pointless.

**Requirements:**

1. **A capture box is visible and one tap away from every screen.** On mobile: a persistent input
   at the top of the list plus a thumb-reachable `+` button. Keyboard opens focused in the field.
2. **Type or dictate, hit enter, task exists.** No modal. No required fields. No "choose a list"
   step. The list updates in place and the field stays focused for the next one.
3. **Brain-dump mode:** if I paste or dictate multiple lines, create one task per line. Show me the
   N tasks it created with a single undo.
4. **Natural-language parsing, with visible receipts.** Parse the typed/dictated string for:
   - **Dates:** "tomorrow", "friday", "next friday", "in 7 days", "by monday", "9/14", "this weekend"
     → `dueDate`. The word "by" or "want it done by" leans `targetDate`.
   - **Durations:** "10 min", "half hour", "2-3 hours" (take the midpoint, mark `guess`),
     "all day" → `estimateMinutes`.
   - **Tags:** explicit `#army`, plus keyword inference (mechanic→`admin`+`out`, LinkedIn→`career`,
     laundry→`home`, "call X"→`people`+`phone`).
   - Use `chrono-node` for dates; hand-rolled regex for the rest.
5. **Parsing is never destructive and never blocking.** Whatever it extracts appears as removable
   chips under the input for ~4 seconds. Tap a chip to undo that inference. Anything it can't
   parse stays in the title verbatim. **A wrong guess must always be cheaper to fix than a missing
   guess is to add.** When in doubt, parse nothing.
6. Dictation-friendly: no auto-capitalize fighting, no character limits, no submit-on-silence.

Target: from home screen to captured thought, under five seconds, one-handed, while walking.

---

## 6. "What should I do today?" — the core feature

A big obvious button. Tapping it asks me at most three quick things (all chip-based, all
skippable, all remembered as defaults):

- **How much time do I have?** `30m` `1h` `2h` `half day (4h)` `full day (8h)` `custom`
- **What kind of energy?** `fried` `normal` `sharp` *(optional)*
- **Focus on anything?** tag chips, multi-select, or "whatever" *(optional)*

It returns **an ordered plan with a running clock**, not a filtered list:

```
You've got 4 hours. Here's the run:

 9:00 – 9:45   Build UCMJ class slides          ⚑ due Mon, you wanted it done Sun
 9:45 – 9:55   Call Dad                          quick win, been sitting 11 days
10:00 – 12:30  Mechanic                          2–3h guess, has to happen while they're open
12:30 – 1:00   Post on LinkedIn                  fits the gap

  Total: 3h 55m of 4h.

If you get more time:  Organize 2026 photos (~2h) · Clean living room (~1h)
Not planned:  Laundry (needs you home) · VA claim follow-up (business hours, it's Saturday)
```

Every line carries **a one-line reason.** I need to be able to see *why* it's telling me this, or I
won't trust it. Add an "explain" toggle that reveals the score breakdown per task.

### 6.1 The scoring algorithm

Deterministic, explainable, instant, offline. **No LLM call required for the core planner** —
optional AI layer is a later phase (§11).

```
score = urgency + importance + fit + momentum + staleness − friction
```

**urgency (0–130)** — uses `effectiveDate = targetDate ?? dueDate`
- overdue: `100 + 5×daysOverdue`, capped at 130
- due today: 90 · tomorrow: 70 · within 3 days: 55 · within 7 days: 35 · within 30: 15
- no date: 10
- **runway check (important):** if `estimateMinutes` remaining exceeds the realistic hours left
  before the deadline (assume ~4 usable hours/day), add +25 and flag it. This is what makes the
  move-in-7-days task start nagging on day one instead of ambushing me on Thursday night.

**importance (0–90)**
- priority: low 0 · normal 10 · high 25 · critical 40
- `pinned`: +50

**fit (−100 to +15)** — against *remaining* time in the plan
- fits with room: +10 · fits almost exactly: +15
- doesn't fit and has no subtasks to partially do: −100 → drops to "if you get more time"
- doesn't fit but has subtasks: plan the subtasks that do fit
- **unknown duration: assume 45 min, mark the line with `~?`, and never let an unknown-duration
  task be the only thing in a plan.** Offer "how long do you think?" inline after planning.

**momentum (0–10)** — tasks ≤15 min get +8, but only for the first slot of the plan. Open the day
with a win, don't spend the whole day on ten-minute crumbs.

**staleness (0–15)** — +1 per week since `createdAt`, dateless tasks only, capped at 15. Things I
keep skipping should slowly start surfacing on their own.

**friction (0–20)** — >2h with no subtasks and no near deadline: −15, and the UI offers
"break this down?" instead. Big vague tasks are why lists die.

**Hard filters (applied before scoring):**
- `status !== 'open'` → out
- `snoozedUntil > now` → out
- focus tags selected → non-matching out
- energy `fried` → `effort: 'deep'` tasks demoted hard (−40), not removed
- `context: business-hours` → excluded outside Mon–Fri 0900–1700 local, with a visible reason
- `context: phone` → demoted before 9am and after 8pm

**Sequencing rules (after scoring, before display):**
- Deep-effort work goes early in the plan, not after three hours of errands
- `out` / errand tasks cluster together into one trip
- Hard-deadline items never get bumped below soft ones on the same day
- Insert a 10-min buffer after anything over 90 minutes

### 6.2 Planner interactions
- **"Not today"** on any line → snoozes it and instantly re-plans around the gap
- **"Swap this"** → next-best task that fits the same slot
- **"More time than I thought"** → extend the budget, extend the plan
- Check items off directly from the plan; the plan reflows and shows time reclaimed
- The plan is ephemeral. It's a suggestion, not a schedule I've now failed to follow.

### 6.3 The hero card
A "right now, just do this one thing" card at the top of the home screen — the single
highest-scoring task that fits a 30-minute window. For the days when a whole plan is too much to
look at. One task, one button.

---

## 7. The list

**Checklist behavior:**
- Tap the circle → done. Satisfying, immediate, with a 5-second undo toast. No confirmation dialog.
- Tap anywhere else on the row → expands **inline** (not a new page) to show notes, subtasks, tags,
  dates, duration, priority, and edit controls. Tap again to collapse.
- Long-press / swipe → quick actions: snooze, pin, delete, duplicate.
- Every field is editable in place. No separate "edit mode."

**Row anatomy (mobile, one line + one subline):**
`○  Build UCMJ class slides`
`   army · ⚑ Mon (want Sun) · ~45m`

Overdue in red. Hard deadlines get the ⚑. Soft targets in parentheses. Duration always
approximate-looking (`~45m`, never `45m`) so I remember it's a guess I made.

**Views (bottom nav or segmented control):**
- **Today** — the plan + anything due/targeted today + pinned + overdue
- **All** — everything open
- **Tags** — grouped by tag, collapsible sections, with counts
- **Someday** — no date, no urgency, the "eventually" pile (most of the VA stuff lives here)
- **Done** — §8

**Sort & filter (persisted, applied to any view):**
- Sort by: smart score (default) · due date · target date · duration (asc/desc) · priority · created
- Filter by: tag (multi) · has/no deadline · duration under N · priority · effort · context
- Free-text search across title, notes, subtasks

---

## 8. Completed tasks

- Live at the **bottom of the list, below a collapsed divider** — `▸ Completed (14)` — exactly like
  I described: scroll down, see everything I've finished.
- Grouped by day, newest first: "Today (3) · Yesterday (5) · Aug 19 (2)…"
- Uncheck to restore, fully intact.
- Never auto-delete. Never hide older than N days. Show me the receipts — seeing the pile is the
  point.
- Small stat line, no gamification: "12 tasks · ~6h of estimated work this week."

---

## 9. Data safety

This becomes my external memory, so losing it is unacceptable.

- Every change persisted immediately to `localStorage`. (Built with `localStorage` rather than
  IndexedDB as originally specced: the whole task list is a few KB of text against a ~5 MB budget,
  and a synchronous store has no async failure modes to reason about. Revisit only if attachments
  ever land here.)
- **Export to JSON** — one button, always available. Also export to plain markdown checklist.
- **Import from JSON** — restore or merge.
- Rolling local snapshots: keep the last 10 auto-saves, restorable from settings.
- If sync is enabled (§12), local always wins on conflict; the network is never in the critical
  path of a keystroke.

---

## 10. Seed data

Ship the app pre-loaded with these real tasks so it's useful the moment it opens, and so the
planner has something to reason about. Clearly marked, one-button "clear seed data."

| Task | Tags | Dates | Est. |
|---|---|---|---|
| Move to the new place | house, home | **hard: this Friday** | 12h, has subtasks |
| ↳ pack the kitchen / book the truck / change address / pack closet / final walkthrough | | | |
| Teach UCMJ class for OCS | army, career | **hard: Monday**, target: Sunday | 3h, deep |
| Clean up the living room | home | — | ~1h, light |
| Take the car to the mechanic | admin | — | ~2.5h *(guess)*, out, business-hours |
| Make a post on LinkedIn | career | — | ~30m |
| Organize photos from 2026 | growth, fun | — | ~2h, light |
| Call Dad | people | — | ~10m, phone |
| Do laundry | home | — | ~1h *(mostly waiting)*, home |
| Research healthy food / meal ideas | health, growth | — | ~45m |
| Call friend + make plans to hang out | people, fun | — | ~15m, phone |
| VA — follow up on claim status | va | — | ~30m, business-hours |

---

## 11. Phasing

**v1 (build this):** everything in §3–§10. Local-only, one device.

**v2 (only after v1 is in daily use and has proven what's missing):**
- Sync across phone + laptop
- Optional AI planner layer: send the shortlist to Claude for a second opinion on ordering and a
  short pep-talk framing. Deterministic planner stays the default and the fallback — the app must
  never be unusable because an API key expired.
- Recurring tasks
- Calendar read (know when I'm actually free instead of me typing "4 hours")
- Estimate calibration: track actual vs. estimated over time and quietly correct my guesses
  ("you say 30 minutes for LinkedIn posts; it's been 50")

---

## 12. Decisions — settled

1. **One device.** Phone-only, `localStorage`. No backend, no sync, no account. JSON export is the
   backup story.
2. **Math planner in v1.** Deterministic scoring, instant and offline. An AI layer stays a v2
   option once real use shows where its judgment is wrong.
3. **Static build**, deployable anywhere; installable to the home screen as a PWA.
4. **Dark only** for now. A light mode can come later if it's ever wanted.

### Known gaps in the v1 build

- No swipe or long-press gestures on rows. Every quick action (pin, snooze, someday, waiting,
  delete) lives in the expanded row instead. Add gestures later if reaching for them is annoying.
- No "duplicate task."
- Tag merge works by renaming one tag onto another rather than a dedicated merge picker.
- Seed dates are computed relative to install (next Friday / next Monday), not your real calendar.

## 13. Context that would tune the planner

Optional, but each of these directly changes the defaults:

- **Weekly rhythm** — work hours, drill weekends, OCS commitments, class nights. Determines when
  "free time" actually exists and how the runway math works.
- **What a good day looks like** — one big deep push, or lots of small wins? Changes how momentum
  and friction are weighted.
- **What you avoid** — the specific things that sit on the list for months. Staleness weighting
  gets tuned to nag on those specifically.
- **The VA pile** — is it a handful of items or dozens? Determines whether `va` needs to be its own
  view instead of just a tag.
- **The move and OCS timeline** — real dates, so seed data is real instead of illustrative.
