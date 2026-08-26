import { beforeEach, describe, expect, it } from 'vitest'
import type { Task } from '../../types'
import { applyLog, backfillLog, loadLog, normaliseTitle, rebuildLog, recordDone, recordUndone } from '../completions'

const AT = '2026-08-26T12:00:00.000Z'

function store(): Record<string, string> {
  const data: Record<string, string> = {}
  return data
}

beforeEach(() => {
  const data = store()
  // A minimal localStorage that the module can talk to.
  globalThis.localStorage = {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
    removeItem: (k: string) => {
      delete data[k]
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k]
    },
    key: () => null,
    length: 0,
  } as unknown as Storage
})

let n = 0
const task = (title: string, over: Partial<Task> = {}): Task => ({
  id: `t${n++}`,
  title,
  tags: [],
  status: 'open',
  priority: 'normal',
  createdAt: AT,
  updatedAt: AT,
  ...over,
})

describe('finishing something is recorded outside the task list', () => {
  it('remembers a completion', () => {
    recordDone('Call Dad', AT)
    expect(loadLog()[normaliseTitle('Call Dad')]).toEqual({ title: 'Call Dad', at: AT })
  })

  it('keeps the original date if the same thing is finished again', () => {
    recordDone('Call Dad', AT)
    recordDone('Call Dad', '2027-01-01T00:00:00.000Z')
    expect(loadLog()[normaliseTitle('Call Dad')].at).toBe(AT)
  })

  it('forgets it only when deliberately un-ticked', () => {
    recordDone('Call Dad', AT)
    recordUndone('Call Dad')
    expect(loadLog()[normaliseTitle('Call Dad')]).toBeUndefined()
  })

  it('ignores a blank title rather than storing junk', () => {
    recordDone('   ', AT)
    expect(Object.keys(loadLog())).toHaveLength(0)
  })
})

describe('completions survive the list being rebuilt', () => {
  it('restores a finished task even when the list came back fresh', () => {
    recordDone('Call Dad', AT)
    // A brand new copy, different id, not marked done — as a reseed would produce.
    const { tasks, restored } = applyLog([task('Call Dad'), task('Do laundry')])
    expect(restored).toBe(1)
    expect(tasks[0].status).toBe('done')
    expect(tasks[0].completedAt).toBe(AT)
    expect(tasks[1].status).toBe('open')
  })

  it('matches on the title regardless of case and punctuation', () => {
    recordDone('VA — follow up on claim status', AT)
    const { restored } = applyLog([task('va follow up on claim status')])
    expect(restored).toBe(1)
  })

  it('leaves an already-finished task exactly as it is', () => {
    recordDone('Call Dad', AT)
    const original = task('Call Dad', { status: 'done', completedAt: '2020-01-01T00:00:00.000Z' })
    const { tasks, restored } = applyLog([original])
    expect(restored).toBe(0)
    expect(tasks[0].completedAt).toBe('2020-01-01T00:00:00.000Z')
  })

  it('brings back a finished task whose row was lost entirely', () => {
    recordDone('Something I typed and finished', AT)
    const { tasks, restored } = applyLog([task('Get the car diagnosed')])
    expect(restored).toBe(1)
    const revived = tasks.find((t) => t.title === 'Something I typed and finished')
    expect(revived?.status).toBe('done')
    expect(revived?.completedAt).toBe(AT)
    expect(revived?.tags).toContain('unsorted')
  })

  it('does nothing at all when nothing has been finished', () => {
    const tasks = [task('Call Dad')]
    const result = applyLog(tasks)
    expect(result.restored).toBe(0)
    expect(result.tasks).toBe(tasks)
  })

  it('survives a wholesale list replacement — the real failure mode', () => {
    recordDone('Do the food stamps paperwork', AT)
    recordDone('Call about the blocked army forms', AT)
    const wiped = [
      task('Do the food stamps paperwork'),
      task('Call about the blocked army forms'),
      task('Get the car diagnosed'),
    ]
    const { tasks, restored } = applyLog(wiped)
    expect(restored).toBe(2)
    expect(tasks.filter((t) => t.status === 'done')).toHaveLength(2)
  })
})

describe('completions that predate the record', () => {
  it('adopts anything already ticked off', () => {
    const added = backfillLog([task('Call Dad', { status: 'done', completedAt: AT }), task('Do laundry')])
    expect(added).toBe(1)
    expect(loadLog()[normaliseTitle('Call Dad')].at).toBe(AT)
  })

  it('never removes an entry it did not add', () => {
    recordDone('Something else', AT)
    backfillLog([task('Do laundry')])
    expect(loadLog()[normaliseTitle('Something else')]).toBeTruthy()
  })

  it('does not overwrite a date already recorded', () => {
    recordDone('Call Dad', AT)
    backfillLog([task('Call Dad', { status: 'done', completedAt: '2030-01-01T00:00:00.000Z' })])
    expect(loadLog()[normaliseTitle('Call Dad')].at).toBe(AT)
  })
})

describe('restoring a backup', () => {
  it('makes the record follow the backup rather than fighting it', () => {
    recordDone('Something I finished before', AT)
    rebuildLog([task('Call Dad', { status: 'done', completedAt: AT }), task('Do laundry')])
    const log = loadLog()
    expect(log[normaliseTitle('Call Dad')].at).toBe(AT)
    expect(log[normaliseTitle('Something I finished before')]).toBeUndefined()
  })
})

describe('a broken record can never break the app', () => {
  it('shrugs off corrupt storage', () => {
    localStorage.setItem('todo.completions.v1', '{ not json')
    expect(loadLog()).toEqual({})
    expect(applyLog([task('Call Dad')]).restored).toBe(0)
  })

  it('ignores entries that are neither a timestamp nor a proper record', () => {
    localStorage.setItem('todo.completions.v1', JSON.stringify({ good: AT, bad: 42, worse: null }))
    expect(loadLog()).toEqual({ good: { title: 'good', at: AT } })
  })

  it('reads an older timestamp-only record', () => {
    localStorage.setItem('todo.completions.v1', JSON.stringify({ 'call dad': AT }))
    const { tasks, restored } = applyLog([task('Call Dad')])
    expect(restored).toBe(1)
    expect(tasks[0].status).toBe('done')
  })
})
