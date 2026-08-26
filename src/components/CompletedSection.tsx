import { useMemo, useState } from 'react'
import type { Task } from '../types'
import { formatDate, formatDuration, todayISO } from '../lib/dates'
import { Icon } from './ui'
import { TaskList } from './TaskRow'

/** Completed work lives at the bottom. Seeing the pile is the whole point. */
export function CompletedSection({
  tasks,
  defaultOpen = false,
  /** The Done tab: a full archive, always open, no drawer to fight with. */
  archive = false,
}: {
  tasks: Task[]
  defaultOpen?: boolean
  archive?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || archive)
  const today = todayISO()
  // Fixed at mount so the "this week" line doesn't shift under a re-render.
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))

  const { groups, thisWeek } = useMemo(() => {
    const done = tasks
      .filter((t) => t.status === 'done')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    const byDay = new Map<string, Task[]>()
    for (const task of done) {
      const day = (task.completedAt ?? task.updatedAt).slice(0, 10)
      const list = byDay.get(day)
      if (list) list.push(task)
      else byDay.set(day, [task])
    }
    const entries = [...byDay.entries()]
    return { groups: entries, thisWeek: entries.filter(([day]) => day >= weekAgo).flatMap(([, list]) => list) }
  }, [tasks, weekAgo])

  const total = groups.reduce((n, [, list]) => n + list.length, 0)

  if (archive && total === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm text-muted">Nothing finished yet.</p>
        <p className="mt-1 text-xs text-faint">Tick something off and it lands here for good.</p>
      </div>
    )
  }
  if (total === 0) return null

  const weekMinutes = thisWeek.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0)

  if (archive) {
    return (
      <section>
        <div className="label flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5 text-faint">
          <span>
            <strong className="text-ink tabular-nums">{total}</strong> finished, all time
          </span>
          {thisWeek.length > 0 && (
            <span className="ml-auto tabular-nums">
              {thisWeek.length} this week{weekMinutes > 0 && ` · ${formatDuration(weekMinutes, false)}`}
            </span>
          )}
        </div>
        {groups.map(([day, list]) => (
          <div key={day}>
            <div className="label bg-surface-2/40 px-4 py-2 text-faint">
              {formatDate(day, today)} — {list.length}
            </div>
            <TaskList tasks={list} today={today} />
          </div>
        ))}
      </section>
    )
  }

  return (
    <section className="mt-6 border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted hover:text-ink"
      >
        <Icon name="chevron" className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        Completed ({total})
        {thisWeek.length > 0 && (
          <span className="meta ml-auto text-faint">
            {thisWeek.length} this week{weekMinutes > 0 && ` · ${formatDuration(weekMinutes, false)}`}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-rise pb-4">
          {groups.map(([day, list]) => (
            <div key={day}>
              <div className="label bg-surface-2/70 px-4 py-2 text-faint">
                {formatDate(day, today)} ({list.length})
              </div>
              <TaskList tasks={list} today={today} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
