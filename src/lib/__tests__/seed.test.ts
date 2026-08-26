import { describe, expect, it } from 'vitest'
import type { Task } from '../../types'
import { DEFAULT_TAGS } from '../../types'
import { buildSeedTasks, SEED_VERSION, shouldReseed } from '../seed'

const NOW = new Date(2026, 7, 24, 9, 0) // Monday

function untouched(): Task[] {
  return buildSeedTasks(NOW)
}

describe('the shipped list', () => {
  it('is there', () => {
    expect(untouched().length).toBeGreaterThan(40)
  })

  it('marks everything as shipped, so it can be cleared later', () => {
    expect(untouched().every((t) => t.seed)).toBe(true)
  })

  it('gives every task a title and at least one tag', () => {
    for (const t of untouched()) {
      expect(t.title.length, t.title).toBeGreaterThan(0)
      expect(t.tags.length, t.title).toBeGreaterThan(0)
    }
  })

  it('tags richly enough that filtering finds things', () => {
    const tasks = untouched()
    const single = tasks.filter((t) => t.tags.length === 1)
    const average = tasks.reduce((n, t) => n + t.tags.length, 0) / tasks.length
    expect(average).toBeGreaterThan(2)
    // A handful of genuinely single-area tasks is fine; twenty is a gap.
    expect(single.length).toBeLessThanOrEqual(3)
  })

  it('only uses tags that actually exist', () => {
    const known = new Set(DEFAULT_TAGS.map((t) => t.id))
    for (const t of untouched()) {
      for (const tag of t.tags) expect(known.has(tag), `${t.title} -> ${tag}`).toBe(true)
    }
  })

  it('ships nothing already sitting in the unsorted bucket', () => {
    expect(untouched().some((t) => t.tags.includes('unsorted'))).toBe(false)
  })

  it('uses unique ids, including across subtasks', () => {
    const tasks = untouched()
    const ids = [...tasks.map((t) => t.id), ...tasks.flatMap((t) => (t.subtasks ?? []).map((s) => s.id))]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('dates the employer follow-up to the day it is installed', () => {
    const followUp = untouched().find((t) => t.title.includes('employer'))
    expect(followUp?.dueDate).toBe('2026-08-24')
    expect(followUp?.pinned).toBe(true)
  })

  it('parks things that cannot start yet, without hiding them', () => {
    const tasks = untouched()
    const someday = tasks.filter((t) => t.status === 'someday')
    const waiting = tasks.filter((t) => t.status === 'waiting')
    const open = tasks.filter((t) => t.status === 'open')

    // Most of the list should be genuinely actionable, not parked.
    expect(open.length).toBeGreaterThan(waiting.length + someday.length)
    expect(someday.length).toBeGreaterThanOrEqual(4)
    expect(waiting.length).toBeGreaterThanOrEqual(4)
  })

  it('says why each blocked task is blocked', () => {
    for (const t of untouched().filter((x) => x.status === 'waiting')) {
      expect(t.notes, t.title).toBeTruthy()
      expect(t.notes, t.title).toMatch(/blocked|until|before|after|need/i)
    }
  })

  it('explains every task it ships', () => {
    for (const t of untouched()) {
      expect(t.notes?.trim(), t.title).toBeTruthy()
    }
  })

  it('does not duplicate the purge as both a task and a step of the move', () => {
    const tasks = untouched()
    const move = tasks.find((t) => t.title === 'Move downstairs')
    expect(move?.subtasks?.some((s) => /purge/i.test(s.title))).toBe(false)
    expect(tasks.some((t) => /get rid of a big chunk/i.test(t.title))).toBe(true)
  })
})

/**
 * This is the dangerous one. A wrong `true` here silently destroys real work.
 */
describe('reseeding never eats your data', () => {
  it('replaces a list that has not been touched', () => {
    expect(shouldReseed(untouched(), 1)).toBe(true)
  })

  it('leaves it alone once you have ticked something off', () => {
    const tasks = untouched()
    tasks[3] = { ...tasks[3], status: 'done', completedAt: NOW.toISOString() }
    expect(shouldReseed(tasks, 1)).toBe(false)
  })

  it('leaves it alone once you have edited something', () => {
    const tasks = untouched()
    tasks[5] = { ...tasks[5], title: 'my own wording', updatedAt: '2026-09-01T00:00:00.000Z' }
    expect(shouldReseed(tasks, 1)).toBe(false)
  })

  it('leaves it alone once you have added your own task', () => {
    const tasks = [
      ...untouched(),
      {
        id: 'mine',
        title: 'something I typed',
        tags: [],
        status: 'open' as const,
        priority: 'normal' as const,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ]
    expect(shouldReseed(tasks, 1)).toBe(false)
  })

  it('leaves it alone once already on the current version', () => {
    expect(shouldReseed(untouched(), SEED_VERSION)).toBe(false)
  })

  it('does not resurrect a list you deliberately cleared', () => {
    expect(shouldReseed([], 1)).toBe(false)
  })

  it('does not reseed a future version back down', () => {
    expect(shouldReseed(untouched(), SEED_VERSION + 1)).toBe(false)
  })
})
