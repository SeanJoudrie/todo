import { describe, expect, it } from 'vitest'
import type { Task } from '../../types'
import { addDays, todayISO } from '../dates'
import { baseScore, buildPlan, heroTask, remainingWork } from '../planner'

// Wednesday 9:00 AM — inside business hours, so nothing is filtered for the clock.
const NOW = new Date(2026, 7, 19, 9, 0)
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

const req = (over: Partial<Parameters<typeof buildPlan>[1]> = {}) => ({
  budgetMinutes: 240,
  energy: 'normal' as const,
  focusTags: [] as string[],
  now: NOW,
  ...over,
})

describe('scoring', () => {
  it('ranks overdue above everything else', () => {
    const late = baseScore(task({ dueDate: addDays(TODAY, -3) }), req())
    const soon = baseScore(task({ dueDate: addDays(TODAY, 1) }), req())
    expect(late.score).toBeGreaterThan(soon.score)
    expect(late.reasons[0]).toBe('3 days late')
  })

  it('plans to the soft target, not the hard deadline', () => {
    const soft = task({ dueDate: addDays(TODAY, 5), targetDate: addDays(TODAY, 1) })
    const hardOnly = task({ dueDate: addDays(TODAY, 5) })
    expect(baseScore(soft, req()).score).toBeGreaterThan(baseScore(hardOnly, req()).score)
  })

  it('raises the alarm when there is not enough runway left', () => {
    // 12 hours of work, 3 days out: ~4 usable hours a day is not enough.
    const cramped = task({ dueDate: addDays(TODAY, 3), estimateMinutes: 720 })
    const roomy = task({ dueDate: addDays(TODAY, 3), estimateMinutes: 30 })
    expect(baseScore(cramped, req()).score).toBeGreaterThan(baseScore(roomy, req()).score)
    expect(baseScore(cramped, req()).reasons[0]).toMatch(/start now/)
  })

  it('lets dateless tasks drift up as they age', () => {
    const old = task({ createdAt: new Date(2026, 4, 1).toISOString() })
    const fresh = task()
    expect(baseScore(old, req()).score).toBeGreaterThan(baseScore(fresh, req()).score)
  })

  it('demotes deep work when I am fried', () => {
    const deep = task({ effort: 'deep' })
    expect(baseScore(deep, req({ energy: 'fried' })).score).toBeLessThan(baseScore(deep, req()).score)
  })

  it('scales remaining work down as subtasks get ticked', () => {
    const t = task({
      estimateMinutes: 100,
      subtasks: [
        { id: 'a', title: 'a', done: true },
        { id: 'b', title: 'b', done: false },
      ],
    })
    expect(remainingWork(t)).toBe(50)
  })
})

describe('plan construction', () => {
  it('never overruns the budget', () => {
    const tasks = Array.from({ length: 12 }, () => task({ estimateMinutes: 45 }))
    const plan = buildPlan(tasks, req({ budgetMinutes: 120 }))
    expect(plan.usedMinutes).toBeLessThanOrEqual(120)
    expect(plan.items.length).toBeGreaterThan(0)
  })

  it('pushes anything too big into spillover rather than dropping it', () => {
    const big = task({ title: 'Big', estimateMinutes: 300 })
    const small = task({ title: 'Small', estimateMinutes: 20 })
    const plan = buildPlan([big, small], req({ budgetMinutes: 30 }))
    expect(plan.items.map((i) => i.task.title)).toEqual(['Small'])
    expect(plan.spillover.map((t) => t.title)).toContain('Big')
  })

  it('lets a task with subtasks be chipped at when it does not fit whole', () => {
    const big = task({
      title: 'Move',
      estimateMinutes: 600,
      dueDate: addDays(TODAY, 2),
      subtasks: [
        { id: 'a', title: 'pack', done: false },
        { id: 'b', title: 'truck', done: false },
      ],
    })
    const plan = buildPlan([big], req({ budgetMinutes: 120 }))
    expect(plan.items[0].partial).toBe(true)
    expect(plan.items[0].reasons[0]).toMatch(/chip away/)
  })

  it('opens with a quick win when one is available', () => {
    const tasks = [task({ title: 'Long', estimateMinutes: 120 }), task({ title: 'Quick', estimateMinutes: 10 })]
    expect(buildPlan(tasks, req({ budgetMinutes: 240 })).items[0].task.title).toBe('Quick')
  })

  it('respects a tag focus', () => {
    const tasks = [task({ title: 'A', tags: ['army'] }), task({ title: 'B', tags: ['fun'] })]
    const plan = buildPlan(tasks, req({ focusTags: ['army'] }))
    expect(plan.items.map((i) => i.task.title)).toEqual(['A'])
  })

  it('holds business-hours tasks until the office is open', () => {
    const t = task({ title: 'VA', contexts: ['business-hours'] })
    const evening = new Date(2026, 7, 19, 21, 0)
    const plan = buildPlan([t], req({ now: evening }))
    expect(plan.items).toHaveLength(0)
    expect(plan.excluded[0].why).toMatch(/closed/)
  })

  it('skips snoozed tasks', () => {
    const t = task({ snoozedUntil: new Date(2026, 7, 20).toISOString() })
    expect(buildPlan([t], req()).items).toHaveLength(0)
  })

  it('groups errands into one trip', () => {
    const tasks = [
      task({ title: 'Mechanic', estimateMinutes: 60, contexts: ['out'] }),
      task({ title: 'Desk work', estimateMinutes: 60, contexts: ['computer'] }),
      task({ title: 'Grocery', estimateMinutes: 30, contexts: ['out'] }),
    ]
    const titles = buildPlan(tasks, req({ budgetMinutes: 300 })).items.map((i) => i.task.title)
    expect(Math.abs(titles.indexOf('Mechanic') - titles.indexOf('Grocery'))).toBe(1)
  })

  it('gives an unknown-duration task company rather than owning the whole plan', () => {
    const unknown = task({ title: 'Vague', dueDate: TODAY })
    const quick = task({ title: 'Quick', estimateMinutes: 10 })
    const plan = buildPlan([unknown, quick], req({ budgetMinutes: 45 }))
    expect(plan.items.length).toBeGreaterThan(1)
    expect(plan.items[0].estimateUnknown).toBe(true)
  })

  it('puts a hard deadline ahead of a soft target landing the same day', () => {
    const hard = task({ title: 'Hard', dueDate: TODAY, estimateMinutes: 60 })
    const soft = task({ title: 'Soft', targetDate: TODAY, dueDate: addDays(TODAY, 6), estimateMinutes: 60 })
    expect(buildPlan([soft, hard], req()).items[0].task.title).toBe('Hard')
  })

  it('every planned item explains itself', () => {
    const tasks = [task({ estimateMinutes: 30, dueDate: TODAY }), task({ estimateMinutes: 30 })]
    for (const item of buildPlan(tasks, req()).items) {
      expect(item.reasons.length).toBeGreaterThan(0)
    }
  })
})

describe('hero task', () => {
  it('picks something that fits a spare half hour', () => {
    const tasks = [task({ title: 'Long', estimateMinutes: 300 }), task({ title: 'Short', estimateMinutes: 15 })]
    expect(heroTask(tasks, NOW)?.task.title).toBe('Short')
  })

  it('falls back to the most pressing thing when nothing is short', () => {
    const tasks = [task({ title: 'Long', estimateMinutes: 300, dueDate: TODAY })]
    expect(heroTask(tasks, NOW)?.task.title).toBe('Long')
  })

  it('returns nothing on an empty list', () => {
    expect(heroTask([], NOW)).toBeNull()
  })
})
