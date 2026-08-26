import type { Task } from '../types'

/**
 * An independent, append-only record of what has been finished.
 *
 * Completions used to live only inside the task list, so anything that rebuilt
 * that list — a reseed, a refresh, a restore, a bug — could take them with it.
 * Finishing something is the one piece of data in this app that must never be
 * lost, so it is also written here, keyed by title rather than id: ids are
 * regenerated whenever the shipped list is rebuilt, titles survive it.
 *
 * Written synchronously the moment a task is ticked off, not on a React
 * effect, so a crash or a reload immediately afterwards cannot lose it.
 */

const KEY = 'todo.completions.v1'

/** Keyed by normalised title; keeps the original wording so a lost task can be rebuilt. */
export type CompletionEntry = { title: string; at: string }
export type CompletionLog = Record<string, CompletionEntry>

export const normaliseTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function loadLog(): CompletionLog {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: CompletionLog = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== 'string' || !key) continue
      // Older records stored just the timestamp.
      if (typeof value === 'string') out[key] = { title: key, at: value }
      else if (
        value &&
        typeof value === 'object' &&
        typeof (value as CompletionEntry).at === 'string' &&
        typeof (value as CompletionEntry).title === 'string'
      ) {
        out[key] = value as CompletionEntry
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeLog(log: CompletionLog): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    /* best effort — a full disk must not break ticking a task off */
  }
}

export function recordDone(title: string, at: string): void {
  const key = normaliseTitle(title)
  if (!key) return
  const log = loadLog()
  // First completion wins, so re-finishing a repeated task keeps the original date.
  if (!log[key]) {
    log[key] = { title: title.trim(), at }
    writeLog(log)
  }
}

/** Deliberately un-ticking something is the one way a completion is removed. */
export function recordUndone(title: string): void {
  const key = normaliseTitle(title)
  const log = loadLog()
  if (log[key]) {
    delete log[key]
    writeLog(log)
  }
}

/**
 * Adopt completions that predate this record — anything already ticked off
 * before the safety net existed, or completed by a build that didn't write
 * here. Purely additive: it never removes an entry.
 */
export function backfillLog(tasks: Task[]): number {
  const log = loadLog()
  let added = 0
  for (const t of tasks) {
    if (t.status !== 'done') continue
    const key = normaliseTitle(t.title)
    if (!key || log[key]) continue
    log[key] = { title: t.title, at: t.completedAt ?? t.updatedAt }
    added++
  }
  if (added > 0) writeLog(log)
  return added
}

/** Rebuild the log from a set of tasks — used when a backup is restored. */
export function rebuildLog(tasks: Task[]): void {
  const log: CompletionLog = {}
  for (const t of tasks) {
    if (t.status === 'done') log[normaliseTitle(t.title)] = { title: t.title, at: t.completedAt ?? t.updatedAt }
  }
  writeLog(log)
}

/**
 * Re-apply the record to a freshly loaded list. Anything finished stays
 * finished, even if the task it belongs to was rebuilt from scratch.
 */
export function applyLog(
  tasks: Task[],
  log = loadLog(),
  makeId: () => string = () => `c${Math.random().toString(36).slice(2, 10)}`,
): { tasks: Task[]; restored: number } {
  if (Object.keys(log).length === 0) return { tasks, restored: 0 }

  let restored = 0
  const seen = new Set<string>()

  const next = tasks.map((task) => {
    const key = normaliseTitle(task.title)
    seen.add(key)
    if (task.status === 'done') return task
    const entry = log[key]
    if (!entry) return task
    restored++
    return { ...task, status: 'done' as const, completedAt: entry.at }
  })

  // A finished task whose row no longer exists — the list was rebuilt without
  // it. Bring it back as done rather than losing the fact that it was done.
  const orphans = Object.entries(log)
    .filter(([key]) => !seen.has(key))
    .map(([, entry]) => ({
      id: makeId(),
      title: entry.title,
      tags: ['unsorted'],
      status: 'done' as const,
      priority: 'normal' as const,
      completedAt: entry.at,
      createdAt: entry.at,
      updatedAt: entry.at,
    }))

  restored += orphans.length
  return { tasks: restored > 0 ? [...next, ...orphans] : tasks, restored }
}
