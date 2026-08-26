import { describe, expect, it } from 'vitest'
import type { Task } from '../../types'
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

  it('parks the income-dependent ones in someday', () => {
    expect(untouched().filter((t) => t.status === 'someday').length).toBe(2)
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
