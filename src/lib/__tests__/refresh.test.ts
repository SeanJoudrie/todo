import { describe, expect, it } from 'vitest'
import type { Task } from '../../types'
import { buildSeedTasks, refreshSeed, shouldReseed } from '../seed'

const NOW = new Date(2026, 7, 24, 9, 0)

/** The original sample list, with "Call Dad" ticked off — the real situation. */
function strandedInstall(): Task[] {
  const stamp = NOW.toISOString()
  const sample = (title: string, over: Partial<Task> = {}): Task => ({
    id: `old-${title}`,
    title,
    tags: ['home'],
    status: 'open',
    priority: 'normal',
    createdAt: stamp,
    updatedAt: stamp,
    seed: true,
    ...over,
  })
  return [
    sample('Move to the new place'),
    sample('Build + teach UCMJ class for OCS'),
    sample('Clean up the living room'),
    sample('Take the car to the mechanic'),
    sample('Make a post on LinkedIn'),
    sample('Organize photos from 2026'),
    sample('Do laundry'),
    sample('Research healthy food / meal ideas'),
    sample('Call friend and make plans to hang out'),
    sample('VA — follow up on claim status'),
    sample('Call Dad', { status: 'done', completedAt: stamp, updatedAt: new Date(2026, 7, 24, 10).toISOString() }),
  ]
}

describe('the install that got stranded on old sample data', () => {
  it('reproduces why it never updated: one completed task locks it forever', () => {
    expect(shouldReseed(strandedInstall(), 1)).toBe(false)
  })

  it('refreshing gets the real list in', () => {
    const { tasks, added } = refreshSeed(strandedInstall(), NOW)
    expect(added).toBeGreaterThan(15)
    expect(tasks.some((t) => t.title.includes('Section 8'))).toBe(true)
    expect(tasks.some((t) => t.title.includes('food stamps'))).toBe(true)
  })

  it('keeps the completed task, because that is real work', () => {
    const { tasks } = refreshSeed(strandedInstall(), NOW)
    const callDad = tasks.find((t) => t.title === 'Call Dad')
    expect(callDad?.status).toBe('done')
    expect(callDad?.completedAt).toBeTruthy()
  })

  it('clears the untouched sample tasks so they are not left as clutter', () => {
    const { tasks, removed } = refreshSeed(strandedInstall(), NOW)
    expect(removed).toBe(10)
    expect(tasks.some((t) => t.title === 'Do laundry')).toBe(false)
    expect(tasks.some((t) => t.title === 'Organize photos from 2026')).toBe(false)
  })
})

describe('a refresh never destroys anything', () => {
  it('keeps a task the owner typed themselves', () => {
    const mine: Task = {
      id: 'mine',
      title: 'Something I typed',
      tags: [],
      status: 'open',
      priority: 'normal',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    }
    const { tasks } = refreshSeed([mine], NOW)
    expect(tasks.find((t) => t.id === 'mine')).toBeTruthy()
  })

  it('keeps a shipped task that was edited, and does not re-add it', () => {
    const edited = {
      ...buildSeedTasks(NOW)[0],
      notes: 'my own wording',
      updatedAt: new Date(2026, 8, 1).toISOString(),
    }
    const { tasks } = refreshSeed([edited], NOW)
    const matches = tasks.filter((t) => t.title === edited.title)
    expect(matches).toHaveLength(1)
    expect(matches[0].notes).toBe('my own wording')
  })

  it('never duplicates a title', () => {
    const { tasks } = refreshSeed(strandedInstall(), NOW)
    const titles = tasks.map((t) => t.title.toLowerCase())
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('is safe to run twice — the second time changes nothing', () => {
    const once = refreshSeed(strandedInstall(), NOW)
    const twice = refreshSeed(once.tasks, NOW)
    expect(twice.added).toBe(0)
    expect(twice.removed).toBe(0)
    expect(twice.tasks).toHaveLength(once.tasks.length)
  })

  it('on an empty list just installs the shipped one', () => {
    const { tasks, removed } = refreshSeed([], NOW)
    expect(removed).toBe(0)
    expect(tasks.length).toBeGreaterThan(15)
  })
})
