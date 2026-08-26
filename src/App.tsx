import { useMemo, useRef, useState } from 'react'
import type { Task } from './types'
import { effectiveDate, todayISO } from './lib/dates'
import { asSortKey, matchesSearch, SORT_KEYS, SORT_LABELS, sortTasks, type SortKey } from './lib/sort'
import { SEED_VERSION } from './lib/seed'
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
 * Everything still outstanding — including work that is blocked, and work
 * snoozed out of today. Neither is `done`, so neither may fall out of every
 * view. Snoozing hides a task from Today; it must never hide it from the list.
 */
const isOutstanding = (t: Task) => t.status === 'open' || t.status === 'waiting'

const isSnoozed = (t: Task, now: string) => isOutstanding(t) && !notSnoozed(t, now)

function Shell() {
  const store = useStore()
  const { tasks, tags } = store
  const [view, setView] = useState<View>(() => {
    const stored = store.settings.lastView
    return (VIEWS.some((v) => v.id === stored) ? stored : 'all') as View
  })
  const [planner, setPlanner] = useState(false)
  const [organize, setOrganize] = useState(false)
  const [settings, setSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>(() => asSortKey(store.settings.lastSort))
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const captureRef = useRef<HTMLTextAreaElement>(null)

  const today = todayISO()
  const nowIso = new Date().toISOString()

  const active = useMemo(() => tasks.filter((t) => isActive(t, nowIso)), [tasks, nowIso])
  const outstanding = useMemo(() => tasks.filter(isOutstanding), [tasks])
  const snoozedTasks = useMemo(
    () => sortTasks(tasks.filter((t) => isSnoozed(t, nowIso)), sort),
    [tasks, nowIso, sort],
  )

  const { dueNow, nextUp } = useMemo(() => {
    const due = active.filter((t) => {
      if (t.pinned) return true
      const eff = effectiveDate(t)
      return eff !== undefined && eff <= today
    })
    const dueIds = new Set(due.map((t) => t.id))
    return {
      dueNow: sortTasks(due, sort),
      // Everything else, best-first. An empty Today screen with a full list is a lie.
      nextUp: sortTasks(active.filter((t) => !dueIds.has(t.id)), sort),
    }
  }, [active, today, sort])

  const visible = useMemo(() => {
    const pool = outstanding.filter((t) => matchesSearch(t, query))
    const tagged = tagFilter.length > 0 ? pool.filter((t) => t.tags.some((x) => tagFilter.includes(x))) : pool
    return sortTasks(tagged, sort)
  }, [outstanding, query, tagFilter, sort])

  const somedayTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === 'someday'), sort),
    [tasks, sort],
  )

  /** Blocked on something else. Surfaced on its own so it can't be forgotten. */
  const waitingTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.status === 'waiting' && notSnoozed(t, nowIso)), sort),
    [tasks, nowIso, sort],
  )

  const grouped = useMemo(() => {
    const byTag = tags
      .map((tag) => ({ tag, list: sortTasks(outstanding.filter((t) => t.tags.includes(tag.id)), sort) }))
      .filter((g) => g.list.length > 0)
    const untagged = sortTasks(outstanding.filter((t) => t.tags.length === 0), sort)
    return { byTag, untagged }
  }, [outstanding, tags, sort])

  const usedTags = useMemo(() => {
    const present = new Set(active.flatMap((t) => t.tags))
    return tags.filter((t) => present.has(t.id))
  }, [active, tags])

  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks])

  const tally = useMemo(
    () => ({
      today: dueNow.length + nextUp.length + waitingTasks.length + snoozedTasks.length,
      all: outstanding.length,
      tags: outstanding.length,
      someday: somedayTasks.length,
      done: doneTasks.length,
      total: tasks.length,
    }),
    [dueNow, nextUp, waitingTasks, snoozedTasks, outstanding, somedayTasks, doneTasks, tasks],
  )

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
              onClick={() => {
                setView(v.id)
                store.setSettings({ lastView: v.id })
              }}
              aria-current={view === v.id}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                view === v.id ? 'bg-surface-3 font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
              <span className="meta ml-1 text-faint tabular-nums">{tally[v.id]}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="meta flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-1.5 text-muted">
        <span>
          <strong className="font-semibold text-ink tabular-nums">{tally.all}</strong> to do
        </span>
        <span className="text-faint">·</span>
        <span className="tabular-nums">{tally.someday} someday</span>
        <span className="text-faint">·</span>
        <span className="tabular-nums">{tally.done} done</span>
        <span className="ml-auto text-faint tabular-nums">{tally.total} total</span>
      </div>

          {store.settings.seedVersion < SEED_VERSION && (
            <div className="animate-rise mx-3 mt-3 rounded-xl border border-accent/50 bg-accent-wash p-3">
              <p className="text-sm leading-snug">
                <strong className="font-medium">Your list is out of date.</strong> There's a newer version of your
                real task list waiting.
              </p>
              <p className="meta mt-1 text-muted">
                Nothing you've added, finished or edited will be touched — only untouched sample tasks are cleared.
              </p>
              <button
                type="button"
                onClick={() => {
                  const previous = store.fullState
                  const { added, removed } = store.loadLatestSeed()
                  store.pushToast(
                    `Loaded ${added} tasks${removed > 0 ? `, cleared ${removed} samples` : ''}`,
                    () => store.replaceAll(previous),
                  )
                }}
                className="mt-2.5 w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-on-accent active:scale-[0.99]"
              >
                Load my real list
              </button>
            </div>
          )}

      <CaptureBar inputRef={captureRef} />

      {view !== 'done' && (
        <SortBar
          sort={sort}
          onChange={(key) => {
            setSort(key)
            store.setSettings({ lastSort: key })
          }}
        />
      )}

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

              {snoozedTasks.length > 0 && (
                <>
                  <div className="label flex items-center gap-2 border-y border-line/60 bg-surface-2/70 px-4 py-2 text-faint">
                    <span>Snoozed ({snoozedTasks.length}) — hidden from today, not gone</span>
                    <button
                      type="button"
                      onClick={() => {
                        snoozedTasks.forEach((t) => store.updateTask(t.id, { snoozedUntil: undefined }))
                        store.pushToast(`Woke ${snoozedTasks.length} tasks back up`)
                      }}
                      className="ml-auto normal-case text-accent hover:underline"
                    >
                      wake all
                    </button>
                  </div>
                  <TaskList tasks={snoozedTasks} today={today} />
                </>
              )}

              {dueNow.length === 0 && nextUp.length === 0 && waitingTasks.length === 0 && snoozedTasks.length === 0 && (
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

        {view === 'done' && <CompletedSection tasks={tasks} archive />}
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

function SortBar({ sort, onChange }: { sort: SortKey; onChange: (key: SortKey) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
      <span className="label shrink-0 text-faint">sort</span>
      {SORT_KEYS.map((key) => (
        <Pill key={key} active={sort === key} onClick={() => onChange(key)}>
          {SORT_LABELS[key]}
        </Pill>
      ))}
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
