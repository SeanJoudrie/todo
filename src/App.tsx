import { useMemo, useRef, useState } from 'react'
import type { Task } from './types'
import { effectiveDate, todayISO } from './lib/dates'
import { matchesSearch, SORT_LABELS, sortTasks, type SortKey } from './lib/sort'
import { StoreProvider } from './store'
import { useStore } from './hooks'
import { CaptureBar } from './components/CaptureBar'
import { CompletedSection } from './components/CompletedSection'
import { HeroCard } from './components/HeroCard'
import { OrganizeSheet } from './components/OrganizeSheet'
import { PlannerSheet } from './components/PlannerSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { TaskList } from './components/TaskRow'
import { Toasts } from './components/Toasts'
import { Empty, Icon, Pill } from './components/ui'

type View = 'today' | 'all' | 'tags' | 'someday' | 'done'

const VIEWS: { id: View; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'all', label: 'All' },
  { id: 'tags', label: 'Tags' },
  { id: 'someday', label: 'Someday' },
  { id: 'done', label: 'Done' },
]

const notSnoozed = (t: Task, now: string) => !(t.snoozedUntil && t.snoozedUntil > now)

/** Actionable right now — what Today and the planner work from. */
const isActive = (t: Task, now: string) => t.status === 'open' && notSnoozed(t, now)

/**
 * Everything still outstanding, including work that is blocked on something
 * else. `waiting` is not `done` — it must never fall out of every view.
 */
const isOutstanding = (t: Task, now: string) =>
  (t.status === 'open' || t.status === 'waiting') && notSnoozed(t, now)

function Shell() {
  const store = useStore()
  const { tasks, tags } = store
  const [view, setView] = useState<View>('today')
  const [planner, setPlanner] = useState(false)
  const [organize, setOrganize] = useState(false)
  const [settings, setSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('smart')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const captureRef = useRef<HTMLTextAreaElement>(null)

  const today = todayISO()
  const nowIso = new Date().toISOString()

  const active = useMemo(() => tasks.filter((t) => isActive(t, nowIso)), [tasks, nowIso])
  const outstanding = useMemo(() => tasks.filter((t) => isOutstanding(t, nowIso)), [tasks, nowIso])

  const { dueNow, nextUp } = useMemo(() => {
    const due = active.filter((t) => {
      if (t.pinned) return true
      const eff = effectiveDate(t)
      return eff !== undefined && eff <= today
    })
    const dueIds = new Set(due.map((t) => t.id))
    return {
      dueNow: sortTasks(due, 'smart'),
      // Everything else, best-first. An empty Today screen with a full list is a lie.
      nextUp: sortTasks(active.filter((t) => !dueIds.has(t.id)), 'smart'),
    }
  }, [active, today])

  const visible = useMemo(() => {
    const pool = outstanding.filter((t) => matchesSearch(t, query))
    const tagged = tagFilter.length > 0 ? pool.filter((t) => t.tags.some((x) => tagFilter.includes(x))) : pool
    return sortTasks(tagged, sort)
  }, [outstanding, query, tagFilter, sort])

  const somedayTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === 'someday'), 'created'),
    [tasks],
  )

  /** Blocked on something else. Surfaced on its own so it can't be forgotten. */
  const waitingTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === 'waiting' && notSnoozed(t, nowIso)), 'smart'),
    [tasks, nowIso],
  )

  const grouped = useMemo(() => {
    const byTag = tags
      .map((tag) => ({ tag, list: sortTasks(outstanding.filter((t) => t.tags.includes(tag.id)), 'smart') }))
      .filter((g) => g.list.length > 0)
    const untagged = sortTasks(outstanding.filter((t) => t.tags.length === 0), 'smart')
    return { byTag, untagged }
  }, [outstanding, tags])

  const usedTags = useMemo(() => {
    const present = new Set(active.flatMap((t) => t.tags))
    return tags.filter((t) => present.has(t.id))
  }, [active, tags])

  const overdueCount = active.filter((t) => {
    const eff = effectiveDate(t)
    return eff !== undefined && eff < today
  }).length

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <h1 className="text-base font-semibold tracking-tight">
            Todo
            {overdueCount > 0 && <span className="ml-2 text-xs font-normal text-danger">{overdueCount} late</span>}
          </h1>
          <button
            type="button"
            onClick={() => setSettings(true)}
            aria-label="Settings"
            className="ml-auto rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="gear" />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={view === v.id}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                view === v.id ? 'bg-surface-3 font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <CaptureBar inputRef={captureRef} />

      <main className="flex-1 pb-28">
        {view === 'today' && (
          <>
            <div className="grid grid-cols-2 gap-2 px-3 pt-3">
              <button
                type="button"
                onClick={() => setPlanner(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-wash py-3 text-sm font-medium text-accent active:scale-[0.99]"
              >
                <Icon name="compass" className="h-4 w-4" />
                What now?
              </button>
              <button
                type="button"
                onClick={() => setOrganize(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-3 text-sm font-medium active:scale-[0.99]"
              >
                <Icon name="sparkle" className="h-4 w-4 text-accent" />
                Dump it
              </button>
            </div>

            <HeroCard onOpenPlanner={() => setPlanner(true)} />

            <div className="mt-5">
              {dueNow.length > 0 && (
                <>
                  <SectionLabel>Due or overdue</SectionLabel>
                  <TaskList tasks={dueNow} today={today} />
                </>
              )}

              {nextUp.length > 0 && (
                <>
                  <SectionLabel>{dueNow.length > 0 ? 'Next up' : 'Nothing due today — next up'}</SectionLabel>
                  <TaskList tasks={nextUp} today={today} />
                </>
              )}

              {waitingTasks.length > 0 && (
                <>
                  <SectionLabel>Blocked — waiting on something else</SectionLabel>
                  <TaskList tasks={waitingTasks} today={today} />
                </>
              )}

              {dueNow.length === 0 && nextUp.length === 0 && waitingTasks.length === 0 && (
                <Empty title="All clear." hint="Talk something into the box up top." />
              )}
            </div>

            <CompletedSection tasks={tasks} />
          </>
        )}

        {view === 'all' && (
          <>
            <div className="space-y-2.5 border-b border-line px-3 py-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search tasks"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-accent/50"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="label text-faint">sort</span>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <Pill key={key} active={sort === key} onClick={() => setSort(key)}>
                    {SORT_LABELS[key]}
                  </Pill>
                ))}
              </div>
              {usedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="label text-faint">tag</span>
                  {usedTags.map((tag) => (
                    <Pill
                      key={tag.id}
                      active={tagFilter.includes(tag.id)}
                      color={tag.color}
                      onClick={() =>
                        setTagFilter((f) => (f.includes(tag.id) ? f.filter((x) => x !== tag.id) : [...f, tag.id]))
                      }
                    >
                      {tag.label}
                    </Pill>
                  ))}
                  {tagFilter.length > 0 && <Pill onClick={() => setTagFilter([])}>clear</Pill>}
                </div>
              )}
            </div>

            {visible.length > 0 ? (
              <TaskList tasks={visible} today={today} />
            ) : (
              <Empty title={query ? `Nothing matches "${query}".` : 'Nothing open.'} />
            )}

            <CompletedSection tasks={tasks} />
          </>
        )}

        {view === 'tags' && (
          <>
            {grouped.byTag.map(({ tag, list }) => (
              <section key={tag.id}>
                <SectionLabel color={tag.color}>
                  {tag.label} ({list.length})
                </SectionLabel>
                <TaskList tasks={list} today={today} />
              </section>
            ))}
            {grouped.untagged.length > 0 && (
              <section>
                <SectionLabel>untagged ({grouped.untagged.length})</SectionLabel>
                <TaskList tasks={grouped.untagged} today={today} />
              </section>
            )}
            {grouped.byTag.length === 0 && grouped.untagged.length === 0 && <Empty title="Nothing open." />}
          </>
        )}

        {view === 'someday' && (
          <>
            <SectionLabel>Eventually — parked on purpose</SectionLabel>
            {somedayTasks.length > 0 ? (
              <TaskList tasks={somedayTasks} today={today} />
            ) : (
              <Empty title="Nothing parked here." />
            )}
          </>
        )}

        {view === 'done' && <CompletedSection tasks={tasks} defaultOpen />}
      </main>

      {/* Thumb-reachable capture */}
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          captureRef.current?.focus()
        }}
        aria-label="Jump to capture"
        className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-black/10 active:scale-95 sm:hidden"
      >
        <Icon name="plus" className="h-6 w-6" />
      </button>

      <OrganizeSheet open={organize} onClose={() => setOrganize(false)} />
      <PlannerSheet open={planner} onClose={() => setPlanner(false)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <Toasts />
    </div>
  )
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="label border-y border-line/60 bg-surface-2/70 px-4 py-2"
      style={{ color: color ?? 'var(--color-faint)' }}
    >
      {children}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
