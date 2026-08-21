import type { Task } from '../types'
import { effectiveDate } from './dates'
import { baseScore, remainingWork } from './planner'

export type SortKey = 'smart' | 'due' | 'duration' | 'priority' | 'created'

export const SORT_LABELS: Record<SortKey, string> = {
  smart: 'smart',
  due: 'due date',
  duration: 'shortest',
  priority: 'priority',
  created: 'newest',
}

const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 } as const

export function sortTasks(tasks: Task[], key: SortKey, now = new Date()): Task[] {
  const req = { budgetMinutes: 240, energy: 'normal' as const, focusTags: [], now }
  const copy = [...tasks]

  switch (key) {
    case 'smart':
      return copy.sort((a, b) => baseScore(b, req).score - baseScore(a, req).score)
    case 'due':
      return copy.sort((a, b) => {
        const da = effectiveDate(a)
        const db = effectiveDate(b)
        if (!da && !db) return 0
        if (!da) return 1 // undated sinks
        if (!db) return -1
        return da.localeCompare(db)
      })
    case 'duration':
      return copy.sort((a, b) => remainingWork(a) - remainingWork(b))
    case 'priority':
      return copy.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    case 'created':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export function matchesSearch(task: Task, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    task.title.toLowerCase().includes(q) ||
    (task.notes ?? '').toLowerCase().includes(q) ||
    (task.subtasks ?? []).some((s) => s.title.toLowerCase().includes(q)) ||
    task.tags.some((t) => t.includes(q))
  )
}
