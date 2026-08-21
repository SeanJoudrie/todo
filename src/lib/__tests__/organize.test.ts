import { describe, expect, it } from 'vitest'
import { organizeLocally, splitDump, stripFiller } from '../organize'

const NOW = new Date(2026, 7, 21, 9, 0) // a Friday

const titles = (text: string) => organizeLocally(text, NOW).map((d) => d.title)

describe('splitting a ramble', () => {
  it('splits on spoken connectors', () => {
    expect(splitDump('I have to clean the garage and I need to call the bank')).toHaveLength(2)
  })

  it('splits on newlines and bullets', () => {
    expect(splitDump('- clean garage\n- call bank\n3. do taxes')).toHaveLength(3)
  })

  it('splits on sentences', () => {
    expect(splitDump('Clean the garage. Call the bank. Do the taxes.')).toHaveLength(3)
  })

  it('does not split a single job', () => {
    expect(splitDump('take the car to the mechanic on tuesday')).toHaveLength(1)
  })
})

describe('stripping filler', () => {
  it('drops spoken openers', () => {
    expect(stripFiller('so um I have to clean the garage')).toBe('Clean the garage')
    expect(stripFiller('okay, call mom')).toBe('Call mom')
  })

  it('drops trailing thinking-out-loud', () => {
    expect(stripFiller("do an army presentation I'll get back to it")).toBe('Do an army presentation')
    expect(stripFiller('organize the photos I dunno')).toBe('Organize the photos')
  })
})

describe('the example from the brief', () => {
  const dump = "I have to do an army presentation I think Tuesday I don't know I'll get back to it"

  it('produces exactly one task', () => {
    expect(organizeLocally(dump, NOW)).toHaveLength(1)
  })

  it('cleans the title down to the actual job', () => {
    expect(titles(dump)[0]).toBe('Do an army presentation')
  })

  it('still catches the date and the tag', () => {
    const [draft] = organizeLocally(dump, NOW)
    expect(draft.patch.dueDate).toBe('2026-08-25') // the coming Tuesday
    expect(draft.patch.tags).toContain('army')
  })

  it('flags that I was hedging', () => {
    expect(organizeLocally(dump, NOW)[0].uncertain).toBe(true)
  })
})

describe('a realistic multi-item dump', () => {
  const dump =
    'ok so I have to clean up my living room and I also need to go to the mechanic ' +
    'probably 2-3 hours, and then I gotta make a post on LinkedIn. ' +
    "Don't forget to call dad 10 min."

  it('finds every job', () => {
    expect(titles(dump)).toHaveLength(4)
  })

  it('names them properly', () => {
    const t = titles(dump)
    expect(t[0]).toMatch(/living room/i)
    expect(t[1]).toMatch(/mechanic/i)
    expect(t[2]).toMatch(/LinkedIn/i)
    expect(t[3]).toMatch(/dad/i)
  })

  it('carries the guesses through', () => {
    const drafts = organizeLocally(dump, NOW)
    expect(drafts[1].patch.estimateMinutes).toBe(150)
    expect(drafts[3].patch.estimateMinutes).toBe(10)
    expect(drafts[3].patch.tags).toContain('people')
  })
})

describe('safety', () => {
  it('drops empty and junk fragments', () => {
    expect(organizeLocally('   \n\n  - \n ok um', NOW)).toHaveLength(0)
  })

  it('never emits a blank title', () => {
    for (const d of organizeLocally('I have to. and also. call mom', NOW)) {
      expect(d.title.length).toBeGreaterThan(0)
    }
  })

  it('deduplicates repeats', () => {
    expect(organizeLocally('call mom\ncall mom', NOW)).toHaveLength(1)
  })

  it('keeps what it was given, so I can check its work', () => {
    expect(organizeLocally('clean the garage', NOW)[0].source).toContain('clean the garage')
  })
})
