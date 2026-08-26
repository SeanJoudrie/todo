import { describe, expect, it } from 'vitest'
import { parseCapture, splitCapture, undoChip } from '../parse'

// A Friday, so weekday parsing has a stable reference.
const NOW = new Date(2026, 7, 21, 9, 0)

describe('durations', () => {
  it('reads a plain minute estimate as known', () => {
    const r = parseCapture('Call dad 10 min', NOW)
    expect(r.patch.estimateMinutes).toBe(10)
    expect(r.patch.estimateConfidence).toBe('known')
    expect(r.title).toBe('Call dad')
  })

  it('takes the midpoint of a range and marks it a guess', () => {
    const r = parseCapture('Go to mechanic 2-3 hours', NOW)
    expect(r.patch.estimateMinutes).toBe(150)
    expect(r.patch.estimateConfidence).toBe('guess')
  })

  it('handles "2 to 3 hours" the same way', () => {
    expect(parseCapture('mechanic 2 to 3 hours', NOW).patch.estimateMinutes).toBe(150)
  })

  it('understands word durations', () => {
    expect(parseCapture('Clean the house half a day', NOW).patch.estimateMinutes).toBe(240)
    expect(parseCapture('Tidy up, half an hour', NOW).patch.estimateMinutes).toBe(30)
  })

  it('does not mistake a duration for a clock time', () => {
    const r = parseCapture('Call dad 10 min', NOW)
    expect(r.patch.dueDate).toBeUndefined()
  })
})

describe('dates', () => {
  it('parses a relative date into a hard deadline', () => {
    const r = parseCapture('Move out in 7 days', NOW)
    expect(r.patch.dueDate).toBe('2026-08-28')
  })

  it('treats the earlier of two dates as the soft target', () => {
    const r = parseCapture('UCMJ class monday, want it done by sunday', NOW)
    expect(r.patch.dueDate).toBe('2026-08-24')
    expect(r.patch.targetDate).toBe('2026-08-23')
  })

  it('never turns a bare year into a deadline', () => {
    const r = parseCapture('Organize photos from 2026', NOW)
    expect(r.patch.dueDate).toBeUndefined()
    expect(r.title).toBe('Organize photos from 2026')
  })

  it('leaves plain quantities alone', () => {
    for (const s of ['Run 5 miles', 'Buy 3 shirts', 'Pay the 200 dollar bill']) {
      const r = parseCapture(s, NOW)
      expect(r.patch.dueDate, s).toBeUndefined()
      expect(r.patch.estimateMinutes, s).toBeUndefined()
    }
  })
})

describe('tags and context', () => {
  it('takes explicit hashtags', () => {
    const r = parseCapture('Sort out my records #army', NOW)
    expect(r.patch.tags).toContain('army')
    expect(r.title).toBe('Sort out my records')
  })

  it('infers tags and contexts from keywords', () => {
    const r = parseCapture('Post on LinkedIn about the promotion', NOW)
    expect(r.patch.tags).toContain('career')
    expect(r.patch.contexts).toContain('computer')
  })

  it('does not read every "call" as a family thing', () => {
    const r = parseCapture('Call the VA about my claim', NOW)
    expect(r.patch.tags ?? []).not.toContain('people')
    expect(r.patch.tags).toContain('va')
    // A phone call is light work, never "deep".
    expect(r.patch.effort).not.toBe('deep')
  })

  it('still catches an actual person', () => {
    expect(parseCapture('Call Dad', NOW).patch.tags).toContain('people')
  })

  it('marks phone calls so they are not planned at 6am', () => {
    expect(parseCapture('Call the VA about my claim', NOW).patch.contexts).toContain('phone')
    expect(parseCapture('Call the VA about my claim', NOW).patch.contexts).toContain('business-hours')
  })
})

describe('everything gets a tag', () => {
  it('falls back to unsorted rather than leaving a task unfindable', () => {
    for (const s of ['Ask Mike about the trailer', 'Sign up for the thing on Saturday', 'Xyzzy']) {
      const tags = parseCapture(s, NOW).patch.tags ?? []
      expect(tags.length, s).toBeGreaterThan(0)
      expect(tags, s).toContain('unsorted')
    }
  })

  it('does not use the fallback when a real tag fits', () => {
    expect(parseCapture('Pay the Xfinity bill', NOW).patch.tags).not.toContain('unsorted')
    expect(parseCapture('Deal with the parking ticket', NOW).patch.tags).toContain('admin')
    expect(parseCapture('Figure out the wifi situation', NOW).patch.tags).toContain('admin')
  })

  it('does not mistake a power tool for a drill weekend', () => {
    expect(parseCapture('Return the drill', NOW).patch.tags).not.toContain('army')
    expect(parseCapture('Pack for drill weekend', NOW).patch.tags).toContain('army')
  })
})

describe('safety', () => {
  it('always produces a non-empty title', () => {
    for (const s of ['tomorrow', '2 hours', '#army', 'x']) {
      expect(parseCapture(s, NOW).title.length, s).toBeGreaterThan(0)
    }
  })

  it('puts lifted text back when an inference is undone', () => {
    const r = parseCapture('Call dad 10 min', NOW)
    const chip = r.chips.find((c) => c.kind === 'estimateMinutes')!
    const undone = undoChip(r, chip.id)
    expect(undone.patch.estimateMinutes).toBeUndefined()
    expect(undone.title.toLowerCase()).toContain('10 min')
  })

  it('drops a tag without touching the rest', () => {
    const r = parseCapture('Call dad 10 min', NOW)
    const chip = r.chips.find((c) => c.kind === 'tag')!
    const undone = undoChip(r, chip.id)
    expect(undone.patch.tags ?? []).not.toContain(chip.value)
    expect(undone.patch.estimateMinutes).toBe(10)
  })
})

describe('brain dump', () => {
  it('splits lines and strips bullets', () => {
    expect(splitCapture('- clean living room\n2. call dad\n\n• do laundry')).toEqual([
      'clean living room',
      'call dad',
      'do laundry',
    ])
  })
})
