import { describe, expect, it } from 'vitest'
import { organizeLocally } from '../organize'

const NOW = new Date(2026, 7, 24, 9, 0) // Monday
const titles = (text: string) => organizeLocally(text, NOW).map((d) => d.title)

describe('"then" as a spoken sequencer', () => {
  it('splits the example verbatim', () => {
    expect(titles('I want to clean my room then call my dad then pay my Xfinity bill')).toEqual([
      'Clean my room',
      'Call my dad',
      'Pay my Xfinity bill',
    ])
  })

  it('handles a comma before it', () => {
    expect(titles('clean my room, then call my dad')).toEqual(['Clean my room', 'Call my dad'])
  })

  it('handles "and then"', () => {
    expect(titles('wash the car and then go to the bank')).toEqual(['Wash the car', 'Go to the bank'])
  })

  it('handles "after that"', () => {
    expect(titles('pay the bill after that book the flight')).toEqual(['Pay the bill', 'Book the flight'])
  })

  it('leaves a trailing "then" alone', () => {
    expect(titles('I guess I will do it then')).toHaveLength(1)
  })
})

describe('"and" only splits before a real task verb', () => {
  it('splits two jobs', () => {
    expect(titles('clean my room and call my dad')).toEqual(['Clean my room', 'Call my dad'])
  })

  it('does not split a compound object', () => {
    expect(titles('call mom and dad')).toEqual(['Call mom and dad'])
  })

  it('does not split ordinary noun pairs', () => {
    for (const s of ['buy mac and cheese', 'get salt and pepper', 'pack shirts and pants']) {
      expect(titles(s), s).toHaveLength(1)
    }
  })
})

describe('single tasks stay single', () => {
  it('leaves a plain capture alone', () => {
    for (const s of ['call dad', 'clean the living room', 'pay the Xfinity bill 10 min']) {
      expect(titles(s), s).toHaveLength(1)
    }
  })

  it('keeps a duration and tag on a split item', () => {
    const drafts = organizeLocally('clean my room then call my dad 10 min', NOW)
    expect(drafts).toHaveLength(2)
    expect(drafts[1].patch.estimateMinutes).toBe(10)
    expect(drafts[1].patch.tags).toContain('people')
  })

  it('still handles a date on one item only', () => {
    const drafts = organizeLocally('clean my room then pay the bill friday', NOW)
    expect(drafts).toHaveLength(2)
    expect(drafts[0].patch.dueDate).toBeUndefined()
    expect(drafts[1].patch.dueDate).toBe('2026-08-28')
  })
})

describe('mixed with the older connectors', () => {
  it('handles a long spoken run', () => {
    expect(
      titles(
        "ok so I have to clean my room then call my dad, and I also need to pay the Xfinity bill. " +
          "Don't forget to book the mechanic.",
      ),
    ).toEqual(['Clean my room', 'Call my dad', 'Pay the Xfinity bill', 'Book the mechanic'])
  })
})
