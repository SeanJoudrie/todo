import * as chrono from 'chrono-node'
import type { Effort, Priority, Task, TaskContext } from '../types'
import { toISODate } from './dates'

/** Fallback when nothing else matched. Never leave a task unfindable. */
export const UNSORTED_TAG = 'unsorted'

export type ChipKind =
  | 'dueDate'
  | 'targetDate'
  | 'estimateMinutes'
  | 'tag'
  | 'priority'
  | 'context'
  | 'effort'

export type Chip = {
  id: string
  kind: ChipKind
  label: string
  /** Text lifted out of the title. Undoing a chip puts it back, so nothing is ever lost. */
  sourceText?: string
  /** For tag/context chips, which value this chip added. */
  value?: string
}

export type ParseResult = {
  title: string
  patch: Partial<Task>
  chips: Chip[]
}

/* -------------------------------------------------------------------------- */
/* Durations                                                                  */
/* -------------------------------------------------------------------------- */

const HOUR_UNIT = /^(h|hr|hrs|hour|hours)$/i
const UNIT = '(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)'

const WORD_DURATIONS: [RegExp, number, boolean][] = [
  [/\ball\s+day\b/i, 480, true],
  [/\bfull\s+day\b/i, 480, true],
  [/\bhalf\s+(?:a\s+)?day\b/i, 240, true],
  [/\bhalf\s+(?:an\s+)?hour\b/i, 30, false],
  [/\ba\s+couple\s+(?:of\s+)?hours\b/i, 120, true],
  [/\ba\s+few\s+hours\b/i, 180, true],
  [/\ba\s+few\s+minutes\b/i, 5, true],
  [/\ban?\s+hour\b/i, 60, false],
  [/\bquick\b/i, 10, true],
]

const HEDGES = /\b(about|around|roughly|maybe|ish|approx|approximately|or so)\b|~/i

type Extracted<T> = { value: T; text: string; index: number }

function extractDuration(text: string): { minutes: number; guess: boolean; spans: Extracted<number>[] } | null {
  // Ranges first ("2-3 hours", "2 to 3 hours") so the single-value pattern can't eat half of one.
  const range = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:-|–|—|to)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, 'i')
  const rm = range.exec(text)
  if (rm) {
    const mid = (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
    const mult = HOUR_UNIT.test(rm[3]) ? 60 : 1
    return { minutes: Math.round(mid * mult), guess: true, spans: [{ value: 0, text: rm[0], index: rm.index }] }
  }

  // "1h 30m" / "1 hour 30 minutes"
  const combo = /\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\s*(\d+)\s*(m|min|mins|minute|minutes)?\b/i
  const cm = combo.exec(text)
  if (cm) {
    const minutes = Math.round(parseFloat(cm[1]) * 60 + parseInt(cm[3], 10))
    return {
      minutes,
      guess: HEDGES.test(text),
      spans: [{ value: 0, text: cm[0], index: cm.index }],
    }
  }

  const single = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, 'i')
  const sm = single.exec(text)
  if (sm) {
    const mult = HOUR_UNIT.test(sm[2]) ? 60 : 1
    return {
      minutes: Math.round(parseFloat(sm[1]) * mult),
      guess: HEDGES.test(text),
      spans: [{ value: 0, text: sm[0], index: sm.index }],
    }
  }

  for (const [re, minutes, guess] of WORD_DURATIONS) {
    const wm = re.exec(text)
    if (wm) return { minutes, guess, spans: [{ value: 0, text: wm[0], index: wm.index }] }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Keyword inference                                                          */
/* -------------------------------------------------------------------------- */

const TAG_KEYWORDS: Record<string, RegExp> = {
  // No bare "drill" — "return the drill" is a power tool, not a drill weekend.
  army: /\b(army|ocs|ucmj|drill weekend|battle assembly|acft|pt test|uniform|national guard|ncoer|oer|platoon|battalion|formation|milpo|ippsa)\b/i,
  va: /\b(va|veterans affairs|disability|claim|c&p|benefits|gi bill)\b/i,
  house: /\b(house|mortgage|realtor|closing|escrow|apartment|lease|landlord|move|moving|pack(?:ing)?|walkthrough)\b/i,
  career: /\b(linkedin|resume|cv|network(?:ing)?|interview|portfolio|cert(?:ification)?|recruiter|job search)\b/i,
  'current-job': /\b(standup|sprint|manager|1:1|one on one|quarterly|okr|timesheet)\b/i,
  growth: /\b(learn|study|read|course|research|practice|tutorial|organize photos)\b/i,
  fun: /\b(movie|game|concert|trip|hike|hang out|hangout|watch|play|beer|dinner out)\b/i,
  // Deliberately no bare "call"/"text" — "call the VA" is admin, not family.
  people: /\b(dad|mom|mother|father|brother|sister|friend|wife|girlfriend|boyfriend|husband|birthday|grandma|grandpa)\b/i,
  health: /\b(gym|doctor|dentist|workout|run|lift|meal|healthy food|nutrition|therapy|sleep|prescription)\b/i,
  home: /\b(laundry|clean|dishes|vacuum|trash|mow|tidy|living room|kitchen|garage|yard|fix the)\b/i,
  admin: /\b(mechanic|dmv|insurance|bill|taxes|bank|registration|renew|appointment|paperwork|passport|ticket|fine|citation|wi-?fi|internet|cable|utility|utilities|license|permit|subscription|refund|warranty|account)\b/i,
}

const CONTEXT_KEYWORDS: Record<TaskContext, RegExp> = {
  phone: /\b(call|phone|ring|text)\b/i,
  out: /\b(mechanic|dmv|store|gym|grocery|pick up|drop off|errand|bank|drive to|go to|appointment|visit)\b/i,
  'business-hours': /\b(va|dmv|mechanic|doctor|dentist|bank|insurance|claim|office|clinic|irs|realtor)\b/i,
  computer: /\b(linkedin|email|resume|slides|code|spreadsheet|website|write|draft|online|photos)\b/i,
  home: /\b(laundry|dishes|clean|vacuum|tidy|living room|kitchen|garage|house)\b/i,
}

const EFFORT_KEYWORDS: [Effort, RegExp][] = [
  [
    'deep',
    /\b(study|write|build|prepare|prep|research|plan|teach|class|slides|draft|design|learn|taxes|budget|strategy)\b/i,
  ],
  ['light', /\b(laundry|dishes|clean|trash|tidy|call|text|water|vacuum|fold)\b/i],
]

const PRIORITY_KEYWORDS: [Priority, RegExp][] = [
  ['critical', /\b(critical|emergency|urgent!!|today no matter what)\b/i],
  ['high', /\b(urgent|asap|important|priority)\b/i],
]

/* -------------------------------------------------------------------------- */
/* Date guards                                                                */
/* -------------------------------------------------------------------------- */

/**
 * chrono is eager. Only accept matches that actually pin down a calendar day —
 * a weekday, a day-of-month, or an explicit relative phrase. A bare year
 * ("photos from 2026") or a bare clock time must never become a deadline.
 */
function isDayLevel(result: chrono.ParsedResult): boolean {
  // `isCertain` distinguishes a value chrono actually read from one it filled in.
  if (!result.start.isCertain('day') && !result.start.isCertain('weekday')) return false
  return /\b(today|tomorrow|tonight|weekend|week|month|next|this|last|coming|in \d+|by|on|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[/-]\d{1,2})/i.test(
    result.text,
  )
}

/* -------------------------------------------------------------------------- */
/* Title cleanup                                                              */
/* -------------------------------------------------------------------------- */

function tidy(text: string): string {
  let out = text
    .replace(/\s{2,}/g, ' ')
    // Connectors left dangling once a date or duration was lifted out.
    .replace(/\s+(on|by|at|for|in|around|about|roughly|it|done)\s*$/i, '')
    .replace(/^\s*(and|then|also)\s+/i, '')
    .replace(/\s*[,;]\s*$/, '')
    .replace(/\s+,/g, ',')
    .trim()
  if (out.length > 0) out = out[0].toUpperCase() + out.slice(1)
  return out
}

/** Removes a span without gluing the surrounding words together. */
function cut(text: string, fragment: string): string {
  const i = text.toLowerCase().indexOf(fragment.toLowerCase())
  if (i === -1) return text
  return `${text.slice(0, i)} ${text.slice(i + fragment.length)}`
}

/* -------------------------------------------------------------------------- */
/* Main entry                                                                 */
/* -------------------------------------------------------------------------- */

export function parseCapture(raw: string, now = new Date()): ParseResult {
  const original = raw.trim()
  let working = original
  const patch: Partial<Task> = {}
  const chips: Chip[] = []
  let n = 0
  const chipId = () => `c${n++}`

  /* 1. Explicit #tags — highest confidence, so they run first. */
  const tags: string[] = []
  working = working.replace(/(^|\s)#([\w-]+)/g, (_m, lead: string, tag: string) => {
    const t = tag.toLowerCase()
    if (!tags.includes(t)) {
      tags.push(t)
      chips.push({ id: chipId(), kind: 'tag', label: `#${t}`, value: t, sourceText: `#${tag}` })
    }
    return lead
  })

  /* 2. Priority markers. */
  for (const [level, re] of PRIORITY_KEYWORDS) {
    if (re.test(working)) {
      patch.priority = level
      chips.push({ id: chipId(), kind: 'priority', label: level })
      break
    }
  }

  /* 3. Durations BEFORE dates — chrono reads "10 min" as a clock time otherwise. */
  const duration = extractDuration(working)
  if (duration) {
    patch.estimateMinutes = duration.minutes
    patch.estimateConfidence = duration.guess ? 'guess' : 'known'
    const span = duration.spans[0].text
    working = cut(working, span)
    const h = duration.minutes >= 60
    chips.push({
      id: chipId(),
      kind: 'estimateMinutes',
      label: `~${h ? `${+(duration.minutes / 60).toFixed(1)}h` : `${duration.minutes}m`}`,
      sourceText: span,
    })
  }

  /* 4. Dates. Two dates means a soft target and a hard deadline: earliest is the target. */
  const found = chrono.parse(working, now, { forwardDate: true }).filter(isDayLevel)
  if (found.length > 0) {
    const sorted = [...found].sort((a, b) => a.start.date().getTime() - b.start.date().getTime())
    const hard = sorted[sorted.length - 1]
    patch.dueDate = toISODate(hard.start.date())
    working = cut(working, hard.text)
    chips.push({ id: chipId(), kind: 'dueDate', label: `due ${hard.text.trim()}`, sourceText: hard.text })

    if (sorted.length > 1) {
      const soft = sorted[0]
      patch.targetDate = toISODate(soft.start.date())
      working = cut(working, soft.text)
      chips.push({ id: chipId(), kind: 'targetDate', label: `target ${soft.text.trim()}`, sourceText: soft.text })
    }
  }

  /* 5. Keyword inference runs on the ORIGINAL text — the useful words may have been cut. */
  for (const [tag, re] of Object.entries(TAG_KEYWORDS)) {
    if (tags.includes(tag)) continue
    if (re.test(original)) {
      tags.push(tag)
      chips.push({ id: chipId(), kind: 'tag', label: `#${tag}`, value: tag })
    }
  }

  const contexts: TaskContext[] = []
  for (const [ctx, re] of Object.entries(CONTEXT_KEYWORDS) as [TaskContext, RegExp][]) {
    if (re.test(original)) contexts.push(ctx)
  }
  if (contexts.length > 0) {
    patch.contexts = contexts
    for (const c of contexts) {
      chips.push({ id: chipId(), kind: 'context', label: c, value: c })
    }
  }

  for (const [effort, re] of EFFORT_KEYWORDS) {
    if (re.test(original)) {
      patch.effort = effort
      chips.push({ id: chipId(), kind: 'effort', label: effort })
      break
    }
  }

  // A task with no tag is invisible to every filter, so it always gets one.
  // `unsorted` is deliberate rather than a forced wrong guess — you can filter
  // by it to find everything still needing a real home.
  if (tags.length === 0) {
    tags.push(UNSORTED_TAG)
    chips.push({ id: chipId(), kind: 'tag', label: `#${UNSORTED_TAG}`, value: UNSORTED_TAG })
  }
  patch.tags = tags

  const title = tidy(working) || original
  return { title, patch, chips }
}

/** Undo one inference. Puts any lifted text back on the title so nothing is lost. */
export function undoChip(result: ParseResult, chipId: string): ParseResult {
  const chip = result.chips.find((c) => c.id === chipId)
  if (!chip) return result

  const patch: Partial<Task> = { ...result.patch }
  if (chip.kind === 'tag') {
    patch.tags = (patch.tags ?? []).filter((t) => t !== chip.value)
    if (patch.tags.length === 0) delete patch.tags
  } else if (chip.kind === 'context') {
    patch.contexts = (patch.contexts ?? []).filter((c) => c !== chip.value)
    if (patch.contexts.length === 0) delete patch.contexts
  } else if (chip.kind === 'estimateMinutes') {
    delete patch.estimateMinutes
    delete patch.estimateConfidence
  } else {
    delete patch[chip.kind]
  }

  const title = chip.sourceText ? tidy(`${result.title} ${chip.sourceText.trim()}`) : result.title
  return { title, patch, chips: result.chips.filter((c) => c.id !== chipId) }
}

/** A dictated or pasted brain dump becomes one task per line. */
export function splitCapture(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
    .filter((line) => line.length > 0)
}
