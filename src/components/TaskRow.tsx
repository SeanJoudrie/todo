import { useState } from 'react'
import type { Task } from '../types'
import { effectiveDate, formatDate, formatDuration, overdueLabel, todayISO } from '../lib/dates'
import { useStore, useTagColors } from '../hooks'
import { TaskEditor } from './TaskEditor'
import { Icon } from './ui'

export function TaskMeta({ task, today }: { task: Task; today: string }) {
  const colors = useTagColors()
  const eff = effectiveDate(task)
  const late = eff ? overdueLabel(eff, today) : null
  const subs = task.subtasks ?? []
  const doneSubs = subs.filter((s) => s.done).length

  return (
    <div className="meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-relaxed">
      {task.tags.map((tag) => (
        <span key={tag} style={{ color: colors[tag] ?? '#5c6070' }}>
          {tag}
        </span>
      ))}

      {task.dueDate && (
        <span className={late ? 'font-medium text-danger' : 'text-muted'}>
          <Icon name="flag" className="mr-0.5 -mt-0.5 inline h-3 w-3" />
          {late ?? formatDate(task.dueDate, today)}
          {task.targetDate && <span className="text-faint"> (want {formatDate(task.targetDate, today)})</span>}
        </span>
      )}

      {!task.dueDate && task.targetDate && (
        <span className={late ? 'font-medium text-danger' : 'text-muted'}>
          {late ?? `want ${formatDate(task.targetDate, today)}`}
        </span>
      )}

      {task.estimateMinutes !== undefined && <span className="text-faint">{formatDuration(task.estimateMinutes)}</span>}

      {subs.length > 0 && (
        <span className="text-faint">
          {doneSubs}/{subs.length} steps
        </span>
      )}

      {task.status === 'waiting' && <span className="text-faint">waiting</span>}
      {task.pinned && <Icon name="pin" className="h-3 w-3 text-accent" />}
    </div>
  )
}

export function TaskRow({ task, today = todayISO() }: { task: Task; today?: string }) {
  const { setDone, removeTask, addTask, pushToast } = useStore()
  const [open, setOpen] = useState(false)
  const done = task.status === 'done'

  return (
    <li className="border-b border-line/60 last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setDone(task.id, !done)
            if (!done) pushToast('Done', () => setDone(task.id, false))
          }}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            done ? 'border-done bg-done text-white' : 'border-faint hover:border-accent active:scale-95'
          }`}
        >
          {done && <Icon name="check" className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block text-[15px] leading-snug ${done ? 'text-faint line-through' : 'text-ink'}`}>
            {task.title}
          </span>
          {!done && <TaskMeta task={task} today={today} />}
          {done && task.completedAt && (
            <span className="meta text-faint">done {formatDate(task.completedAt.slice(0, 10), today)}</span>
          )}
        </button>

        {done ? (
          <button
            type="button"
            onClick={() => {
              const snapshot = task
              removeTask(task.id)
              pushToast('Deleted', () => addTask(snapshot.title, snapshot))
            }}
            aria-label="Delete"
            className="mt-0.5 text-faint hover:text-danger"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        ) : (
          <Icon
            name="chevron"
            className={`mt-1 h-4 w-4 shrink-0 text-faint transition-transform ${open ? 'rotate-90' : ''}`}
          />
        )}
      </div>

      {open && !done && <TaskEditor task={task} />}
    </li>
  )
}

export function TaskList({ tasks, today }: { tasks: Task[]; today?: string }) {
  return (
    <ul className="divide-y-0">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} today={today} />
      ))}
    </ul>
  )
}
