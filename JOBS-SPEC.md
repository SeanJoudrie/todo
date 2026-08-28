# Job scanner — working spec

Status: draft for discussion. Not built yet.

## The one idea

This is **not** a recommendation engine. It is a funnel you build by hand.

Every rule is yours: visible, reorderable, switch-off-able. The system never
decides what you don't see. It does exactly what you told it and shows you the
count after each cut, so you can watch the net tighten and see what each rule
actually cost you.

The reason this matters: the problem with LinkedIn and Indeed isn't that their
algorithm is bad. It's that it's *theirs*, it's invisible, and it optimises for
their engagement rather than your rent. One click on a sales job years ago
should not be able to cost you twelve pages of results, and there should never
be a job you can reach by a friend's link but not by your own search.

---

## Screen 1 — The Pool

One list. Expandable rows. **No pagination** — no "next 10", no page numbers.
It's one continuous list you scroll, virtualised so several thousand rows stay
smooth on a phone.

- **Collapsed row:** title · company · pay · distance · posted · source
- **Tap to expand:** full description, requirements pulled out, apply link, and
  shortcuts to turn anything in it into a rule
- **Sort bar, always visible:** commute · pay · newest · title (each reversible)
- **Search box:** free text. Type `marketing`, the list narrows as you type.

### The filter stack — the core of the whole thing

A vertical list of rules. Each shows how many jobs survived it:

```
  Everything scanned                          4,312
+ within 25 miles of home                     1,204
− contains "sales"                              890
− requires master's or higher                   812
− contains "construction"                       798
− contains "electrician"                        795
+ pay >= $25/hr   (include unlisted pay: no)     402
+ posted in the last 7 days                      268
```

- **Add a rule** by typing it, or by long-pressing a phrase inside any job
  description — "never show me this word again"
- **Toggle** any rule off without deleting it, and watch the count jump back.
  This is how you find out that one rule was quietly killing 400 good jobs.
- **Reorder** by dragging
- **Save the stack as a named net** — "local, no sales", "cleared roles",
  "remote anything" — and switch between them. Nets are how you keep the same
  list and keep cutting it down without starting over.

Rule types: contains / does not contain (title, body, or both) · distance ·
pay floor · posted within · education required · years of experience required ·
employment type · remote / hybrid / onsite · source · company.

**Unlisted pay gets an explicit toggle on every pay rule.** Roughly half of all
postings don't state a number, and a pay floor that silently eats them is the
same invisible-filter problem this app exists to avoid.

---

## Screen 2 — Score

Select any number of jobs (10 is the natural habit) and hit **Next**.

Each one comes back with:

- **A score, 1–10**, and a one-line verdict
- **An expandable "why"** — specific lines, not vibes:
  - matched: Guard service + OCS covers "leadership experience required"
  - missing: wants 5 years, you have 2   ← *this is why it's a 4*
  - unclear: doesn't say whether a clearance is required

Rules for this screen:

- **A low score is never a gate.** A 4/10 stays selectable and still gets a
  cover letter. The score is information you asked for, not permission.
- **The rubric is editable.** It's a text block you and I write together and you
  can change any time — not a hidden prompt. If you decide "years of experience
  matters less than they say", you edit that line and everything rescores.
- Scoring runs on the full job description, not the summary.

---

## Screen 3 — Cover letters

Select from the scored set, hit **Next**, get one letter per job — written from
that job's actual description plus your profile.

- Editable in place, copy button per letter
- **Hard rule: never claim anything your profile doesn't support.** A letter
  that invents experience is worse than no letter.
- Tells you what it deliberately left out, so you can decide whether to add it
  in your own words. The last 10% in your voice is what makes these land.

---

## Wildcard

A separate section that **ignores your filter stack on purpose.** A handful of
jobs that wouldn't survive the funnel and aren't what you'd search for — chosen
against your personality rather than your resume. Pay may be worse. It exists
because a net you tighten every day eventually only catches what you already
expected, and that's its own kind of trap.

---

## Sources — what coverage honestly looks like

| Source | How | What it gets you |
|---|---|---|
| ATS boards — Greenhouse, Lever, Ashby, Workable, SmartRecruiters | public JSON, no key, no login; you name the companies | Deepest and **earliest**. These post days before aggregators pick them up. |
| USAJOBS | free official API | All federal. Veteran preference is a scored advantage here, not a footnote. |
| Adzuna | free API | Broad aggregate across many boards |
| Remotive, Arbeitnow, Hacker News Who's Hiring | free APIs | Remote and tech breadth |
| **LinkedIn / Indeed / ZipRecruiter** | **paste one of their alert emails; it extracts every job in it** | Their matches, but filtered by *your* rules instead of their feed |
| Anything, anywhere | paste a URL or a description | The "my friend linked me a job I can't find myself" case |

Direct scraping of LinkedIn, Indeed and ZipRecruiter is deliberately not in
here. Not squeamishness — their bot defences are good, and the penalty for
losing that fight lands on your account, which you can't afford right now. The
alert-email path gets their listings into the pool without betting your profile
on it.

Distance uses an offline ZIP-code centroid table rather than a geocoding API:
free, no rate limit, no key, and accurate to a couple of miles, which is all a
25-mile radius needs.

---

## How it runs

Same shape as the todo app, because it works and you already trust it:

- Static site on GitHub Pages, phone-first
- A GitHub Action on a schedule does the scanning while you sleep and commits
  the results, so the page is just *there* when you open it
- Your filter stack, saved nets and selections live in `localStorage`
- Scoring and cover letters call Claude with your own API key
- Everything is inspectable in the repo — no service, no account, no algorithm
  you can't read

## Open questions

Tracked separately; see the conversation. The big ones: which sources fill the
pool first, what the commute anchor is, how your profile gets built, and what
Wildcard should optimise for.
