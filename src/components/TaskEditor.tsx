import { useState } from 'react'
import type { Effort, Priority, Task, TaskContext } from '../types'
import { CONTEXTS, CONTEXT_LABELS, EFFORTS, PRIORITIES } from '../types'
import { addDays, formatDuration, todayISO } from '../lib/dates'
import { useStore } from '../hooks'
import { Field, Icon, Pill } from './ui'

const DURATIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 480]

/** Keep a hand-typed or parsed estimate visible even when it isn't one of the presets. */
function durationOptions(current?: number): number[] {
  if (current === undefined || DURATIONS.includes(current)) return DURATIONS
  return [...DURATIONS, current].sort((a, b) => a - b)
}

export function TaskEditor({ task }: { task: Task }) {
  const store = useStore()
  const { updateTask, removeTask, addSubtask, updateSubtask, removeSubtask, upsertTag, pushToast } = store
  const [newSub, setNewSub] = useState('')
  const [newTag, setNewTag] = useState('')

  const toggleTag = (id: string) =>
    updateTask(task.id, {
      tags: task.tags.includes(id) ? task.tags.filter((t) => t !== id) : [...task.tags, id],
    })

  const toggleContext = (c: TaskContext) => {
    const current = task.contexts ?? []
    updateTask(task.id, { contexts: current.includes(c) ? current.filter((x) => x !== c) : [...current, c] })
  }

  const createTag = () => {
    const label = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!label) return
    if (!store.tags.some((t) => t.id === label)) {
      upsertTag({ id: label, label, color: '#5c6070' })
    }
    if (!task.tags.includes(label)) toggleTag(label)
    setNewTag('')
  }

  return (
    <div className="space-y-4 border-t border-line/70 bg-surface/40 px-4 py-4">
      <textarea
        value={task.notes ?? ''}
        onChange={(e) => updateTask(task.id, { notes: e.target.value })}
        placeholder="Notes — talk into it if it's easier"
        rows={2}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed focus:border-accent/50"
      />

      {/* Subtasks */}
      <Field label={`Steps${task.subtasks?.length ? ` (${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})` : ''}`}>
        <div className="space-y-1">
          {(task.subtasks ?? []).map((sub) => (
            <div key={sub.id} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSubtask(task.id, sub.id, { done: !sub.done })}
                aria-label={sub.done ? 'Mark step not done' : 'Mark step done'}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  sub.done ? 'border-done bg-done text-white' : 'border-faint'
                }`}
              >
                {sub.done && <Icon name="check" className="h-3 w-3" />}
              </button>
              <input
                value={sub.title}
                onChange={(e) => updateSubtask(task.id, sub.id, { title: e.target.value })}
                className={`min-w-0 flex-1 text-sm ${sub.done ? 'text-faint line-through' : ''}`}
              />
              <button
                type="button"
                onClick={() => removeSubtask(task.id, sub.id)}
                aria-label="Remove step"
                className="text-faint opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-0.5">
            <Icon name="plus" className="h-3.5 w-3.5 shrink-0 text-faint" />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSub.trim()) {
                  addSubtask(task.id, newSub.trim())
                  setNewSub('')
                }
              }}
              onBlur={() => {
                if (newSub.trim()) {
                  addSubtask(task.id, newSub.trim())
                  setNewSub('')
                }
              }}
              placeholder="Break it down…"
              className="flex-1 text-sm"
            />
          </div>
        </div>
      </Field>

      {/* Tags */}
      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5">
          {store.tags.map((tag) => (
            <Pill key={tag.id} active={task.tags.includes(tag.id)} color={tag.color} onClick={() => toggleTag(tag.id)}>
              {tag.label}
            </Pill>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTag()}
            onBlur={createTag}
            placeholder="+ new"
            className="w-20 rounded-full border border-dashed border-line px-2.5 py-1 text-xs"
          />
        </div>
      </Field>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hard deadline">
          <input
            type="date"
            value={task.dueDate ?? ''}
            onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
          />
        </Field>
        <Field label="Want it done by">
          <input
            type="date"
            value={task.targetDate ?? ''}
            onChange={(e) => updateTask(task.id, { targetDate: e.target.value || undefined })}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
          />
        </Field>
      </div>

      {/* Duration */}
      <Field label={`Rough guess — how long?${task.estimateMinutes ? '' : ' (planner assumes ~45m)'}`}>
        <div className="flex flex-wrap gap-1.5">
          {durationOptions(task.estimateMinutes).map((m) => (
            <Pill
              key={m}
              active={task.estimateMinutes === m}
              onClick={() =>
                updateTask(task.id, {
                  estimateMinutes: task.estimateMinutes === m ? undefined : m,
                  estimateConfidence: task.estimateMinutes === m ? undefined : 'guess',
                })
              }
            >
              {formatDuration(m, false)}
            </Pill>
          ))}
          {task.estimateMinutes !== undefined && (
            <Pill onClick={() => updateTask(task.id, { estimateMinutes: undefined, estimateConfidence: undefined })}>
              no idea
            </Pill>
          )}
        </div>
      </Field>

      {/* Priority / effort */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Pill key={p} active={task.priority === p} onClick={() => updateTask(task.id, { priority: p as Priority })}>
                {p}
              </Pill>
            ))}
          </div>
        </Field>
        <Field label="Brain needed">
          <div className="flex flex-wrap gap-1.5">
            {EFFORTS.map((e) => (
              <Pill
                key={e}
                active={task.effort === e}
                onClick={() => updateTask(task.id, { effort: task.effort === e ? undefined : (e as Effort) })}
              >
                {e}
              </Pill>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Where / when it can happen">
        <div className="flex flex-wrap gap-1.5">
          {CONTEXTS.map((c) => (
            <Pill key={c} active={(task.contexts ?? []).includes(c)} onClick={() => toggleContext(c)}>
              {CONTEXT_LABELS[c]}
            </Pill>
          ))}
        </div>
      </Field>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
        <Pill active={task.pinned} onClick={() => store.togglePin(task.id)}>
          <Icon name="pin" className="h-3 w-3" /> {task.pinned ? 'pinned' : 'pin'}
        </Pill>
        <Pill
          onClick={() => {
            store.snooze(task.id, new Date(`${addDays(todayISO(), 1)}T04:00`))
            pushToast('Snoozed until tomorrow')
          }}
        >
          <Icon name="snooze" className="h-3 w-3" /> tomorrow
        </Pill>
        <Pill
          onClick={() => {
            store.snooze(task.id, new Date(`${addDays(todayISO(), 7)}T04:00`))
            pushToast('Snoozed a week')
          }}
        >
          <Icon name="snooze" className="h-3 w-3" /> a week
        </Pill>
        <Pill
          active={task.status === 'someday'}
          onClick={() => updateTask(task.id, { status: task.status === 'someday' ? 'open' : 'someday' })}
        >
          someday
        </Pill>
        <Pill
          active={task.status === 'waiting'}
          onClick={() => updateTask(task.id, { status: task.status === 'waiting' ? 'open' : 'waiting' })}
        >
          waiting on someone
        </Pill>
        <button
          type="button"
          onClick={() => {
            const snapshot = task
            removeTask(task.id)
            pushToast('Deleted', () => store.addTask(snapshot.title, snapshot))
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-faint hover:border-danger/60 hover:text-danger"
        >
          <Icon name="trash" className="h-3 w-3" /> delete
        </button>
      </div>
    </div>
  )
}
