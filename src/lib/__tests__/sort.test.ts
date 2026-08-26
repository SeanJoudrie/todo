import { describe, expect, it } from 'vitest'
import type { Task } from '../../types'
import { addDays, todayISO } from '../dates'
import { asSortKey, SORT_KEYS, sortTasks } from '../sort'

const NOW = new Date(2026, 7, 24, 9, 0)
const TODAY = todayISO(NOW)

let n = 0
function task(over: Partial<Task> = {}): Task {
  const stamp = NOW.toISOString()
  return {
    id: `t${n++}`,
    title: over.title ?? `Task ${n}`,
    tags: [],
    status: 'open',
    priority: 'normal',
    createdAt: stamp,
    updatedAt: stamp,
    ...over,
  }
}

const titles = (tasks: Task[], key: Parameters<typeof sortTasks>[1]) =>
  sortTasks(tasks, key, NOW).map((t) => t.title)

describe('sorting by time', () => {
  const set = () => [
    task({ title: 'long', estimateMinutes: 240 }),
    task({ title: 'short', estimateMinutes: 10 }),
    task({ title: 'medium', estimateMinutes: 60 }),
  ]

  it('quickest puts the smallest job first', () => {
    expect(titles(set(), 'quickest')).toEqual(['short', 'medium', 'long'])
  })

  it('longest is the exact reverse, for when there is a free afternoon', () => {
    expect(titles(set(), 'longest')).toEqual(['long', 'medium', 'short'])
  })

  it('counts remaining work, not the original estimate', () => {
    const half = task({
      title: 'half done',
      estimateMinutes: 100,
      subtasks: [
        { id: 'a', title: 'a', done: true },
        { id: 'b', title: 'b', done: false },
      ],
    })
    const whole = task({ title: 'untouched', estimateMinutes: 60 })
    expect(titles([whole, half], 'quickest')).toEqual(['half done', 'untouched'])
  })

  it('treats an unestimated task as the assumed 45 minutes, not as zero', () => {
    const order = titles([task({ title: 'unknown' }), task({ title: 'ten', estimateMinutes: 10 })], 'quickest')
    expect(order[0]).toBe('ten')
  })
})

describe('sorting by importance', () => {
  it('ranks critical over high over normal over low', () => {
    const tasks = [
      task({ title: 'low', priority: 'low' }),
      task({ title: 'critical', priority: 'critical' }),
      task({ title: 'normal', priority: 'normal' }),
      task({ title: 'high', priority: 'high' }),
    ]
    expect(titles(tasks, 'importance')).toEqual(['critical', 'high', 'normal', 'low'])
  })

  it('floats anything pinned to the very top', () => {
    const tasks = [
      task({ title: 'critical', priority: 'critical' }),
      task({ title: 'pinned but low', priority: 'low', pinned: true }),
    ]
    expect(titles(tasks, 'importance')[0]).toBe('pinned but low')
  })

  it('breaks ties on urgency rather than leaving them arbitrary', () => {
    const tasks = [
      task({ title: 'later', priority: 'high', dueDate: addDays(TODAY, 20) }),
      task({ title: 'overdue', priority: 'high', dueDate: addDays(TODAY, -3) }),
    ]
    expect(titles(tasks, 'importance')).toEqual(['overdue', 'later'])
  })
})

describe('every sort is safe to apply', () => {
  it('never drops or duplicates a task', () => {
    const tasks = [
      task({ title: 'a', estimateMinutes: 30, dueDate: TODAY }),
      task({ title: 'b', priority: 'high' }),
      task({ title: 'c' }),
    ]
    for (const key of SORT_KEYS) {
      expect(titles(tasks, key).sort(), key).toEqual(['a', 'b', 'c'])
    }
  })

  it('does not mutate the array it was given', () => {
    const tasks = [task({ title: 'z' }), task({ title: 'a', estimateMinutes: 5 })]
    const before = tasks.map((t) => t.title)
    sortTasks(tasks, 'quickest', NOW)
    expect(tasks.map((t) => t.title)).toEqual(before)
  })
})

describe('a stored preference cannot wedge the list', () => {
  it('falls back to smart for anything unrecognised', () => {
    for (const value of ['duration', 'priority', '', null, undefined, 42]) {
      expect(asSortKey(value)).toBe('smart')
    }
  })

  it('keeps a valid key', () => {
    expect(asSortKey('longest')).toBe('longest')
    expect(asSortKey('importance')).toBe('importance')
  })
})
