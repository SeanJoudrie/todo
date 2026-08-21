import type { Energy, Task } from '../types'
import { clockAt, daysBetween, effectiveDate, formatDate, formatDuration, todayISO } from './dates'

/** What we assume a task takes when I never bothered to estimate it. */
export const ASSUMED_MINUTES = 45
/** Realistic hours in a day that can actually go to this list, for runway math. */
export const USABLE_MINUTES_PER_DAY = 240
/**
 * A task that would eat this share of every free minute before its deadline has
 * no real runway left, even if it technically still fits. Strict overflow fires
 * far too late to be useful.
 */
const RUNWAY_SLACK = 0.75
/** Breather after anything long enough to need one. */
const BUFFER_MINUTES = 10
const BUFFER_THRESHOLD = 90

export type PlanRequest = {
  budgetMinutes: number
  energy: Energy
  focusTags: string[]
  now: Date
}

export type ScoreBreakdown = {
  urgency: number
  importance: number
  staleness: number
  friction: number
  energy: number
  fit: number
  momentum: number
  sequencing: number
  total: number
}

export type PlanItem = {
  task: Task
  startMinute: number
  minutes: number
  /** True when the duration is our 45-minute assumption, not the user's estimate. */
  estimateUnknown: boolean
  /** Planned as "chip away at it" because the whole thing didn't fit. */
  partial: boolean
  reasons: string[]
  breakdown: ScoreBreakdown
}

export type Plan = {
  items: PlanItem[]
  spillover: Task[]
  excluded: { task: Task; why: string }[]
  usedMinutes: number
  budgetMinutes: number
  startedAt: Date
}

const PRIORITY_POINTS = { low: 0, normal: 10, high: 25, critical: 40 } as const

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function estimateFor(task: Task): number {
  return task.estimateMinutes ?? ASSUMED_MINUTES
}

/** Estimate scaled down by subtasks already ticked off. */
export function remainingWork(task: Task): number {
  const total = estimateFor(task)
  const subs = task.subtasks ?? []
  if (subs.length === 0) return total
  const left = subs.filter((s) => !s.done).length
  return Math.round((total * left) / subs.length)
}

function hasUndoneSubtasks(task: Task): boolean {
  return (task.subtasks ?? []).some((s) => !s.done)
}

function inBusinessHours(now: Date): boolean {
  const day = now.getDay()
  const hour = now.getHours()
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17
}

/* -------------------------------------------------------------------------- */
/* Base score — everything that doesn't depend on where it lands in the day    */
/* -------------------------------------------------------------------------- */

type Base = {
  breakdown: Omit<ScoreBreakdown, 'fit' | 'momentum' | 'sequencing' | 'total'>
  score: number
  reasons: string[]
}

export function baseScore(task: Task, req: PlanRequest): Base {
  const today = todayISO(req.now)
  const reasons: string[] = []

  /* Urgency */
  let urgency: number
  const eff = effectiveDate(task)
  if (!eff) {
    urgency = 10
  } else {
    const d = daysBetween(today, eff)
    if (d < 0) urgency = Math.min(130, 100 + 5 * -d)
    else if (d === 0) urgency = 90
    else if (d === 1) urgency = 70
    else if (d <= 3) urgency = 55
    else if (d <= 7) urgency = 35
    else if (d <= 30) urgency = 15
    else urgency = 12

    if (d < 0) {
      reasons.push(d === -1 ? '1 day late' : `${-d} days late`)
    } else if (task.dueDate && task.targetDate) {
      reasons.push(`due ${formatDate(task.dueDate, today)}, you wanted it done ${formatDate(task.targetDate, today)}`)
    } else if (d <= 7) {
      reasons.push(`${task.dueDate ? 'due' : 'target'} ${formatDate(eff, today)}`)
    }

    /* Runway: is there physically enough time left to do the work? */
    if (task.estimateMinutes && d >= 0) {
      const available = Math.max(d, 0.5) * USABLE_MINUTES_PER_DAY
      const work = remainingWork(task)
      if (work > available * RUNWAY_SLACK) {
        urgency += 25
        reasons.unshift(`${d === 0 ? 'due today' : `${d} days left`}, ~${Math.round(work / 60)}h of work — start now`)
      }
    }
  }

  /* Importance */
  let importance = PRIORITY_POINTS[task.priority] + (task.pinned ? 50 : 0)
  if (task.pinned) reasons.unshift('pinned')
  // A hard deadline outranks a soft target landing on the same day.
  if (task.dueDate && daysBetween(today, task.dueDate) <= 2) importance += 8

  /* Staleness — only things with no date at all drift upward over time. */
  let staleness = 0
  if (!eff) {
    const age = daysBetween(todayISO(new Date(task.createdAt)), today)
    staleness = Math.min(15, Math.floor(age / 7))
    if (staleness >= 2) reasons.push(`sitting for ${age} days`)
  }

  /* Friction — big vague blocks are why lists die. */
  let friction = 0
  const big = remainingWork(task) > 120
  const soonish = eff ? daysBetween(today, eff) <= 7 : false
  if (big && !hasUndoneSubtasks(task) && !soonish) friction = 15

  /* Energy */
  let energy = 0
  if (task.effort === 'deep') {
    if (req.energy === 'fried') energy = -40
    else if (req.energy === 'sharp') energy = 8
  }

  const breakdown = { urgency, importance, staleness, friction, energy }
  return { breakdown, score: urgency + importance + staleness - friction + energy, reasons }
}

/* -------------------------------------------------------------------------- */
/* Plan construction                                                          */
/* -------------------------------------------------------------------------- */

export function buildPlan(all: Task[], req: PlanRequest): Plan {
  const excluded: { task: Task; why: string }[] = []
  const nowIso = req.now.toISOString()
  const businessOpen = inBusinessHours(req.now)

  const candidates = all.filter((task) => {
    if (task.status !== 'open') return false
    if (task.snoozedUntil && task.snoozedUntil > nowIso) return false
    if (req.focusTags.length > 0 && !task.tags.some((t) => req.focusTags.includes(t))) return false
    if (!businessOpen && task.contexts?.includes('business-hours')) {
      excluded.push({ task, why: "business hours only, and they're closed" })
      return false
    }
    return true
  })

  const bases = new Map(candidates.map((t) => [t.id, baseScore(t, req)]))
  const pool = [...candidates]
  const items: PlanItem[] = []
  let cursor = 0

  while (cursor < req.budgetMinutes - 5 && pool.length > 0) {
    const remaining = req.budgetMinutes - cursor
    const slotStart = new Date(req.now.getTime() + cursor * 60_000)
    const prev = items[items.length - 1]

    let best: { task: Task; score: number; item: PlanItem } | null = null

    for (const task of pool) {
      const base = bases.get(task.id)!
      const work = remainingWork(task)
      const unknown = task.estimateMinutes === undefined
      const reasons = [...base.reasons]

      /* Fit */
      const fitsFully = work <= remaining
      const canPartial = !fitsFully && hasUndoneSubtasks(task) && remaining >= 25
      if (!fitsFully && !canPartial) continue

      const minutes = fitsFully ? work : remaining
      let fit: number
      if (minutes / remaining > 0.85) {
        fit = 15
        if (fitsFully) reasons.push('fits the gap')
      } else {
        fit = 10
      }
      if (canPartial) {
        const left = (task.subtasks ?? []).filter((s) => !s.done).length
        reasons.unshift(`chip away at it — ${left} step${left === 1 ? '' : 's'} left`)
      }

      /* Momentum — one quick win to open with, not a day of crumbs. */
      const momentum = items.length === 0 && work <= 15 ? 8 : 0
      if (momentum > 0) reasons.push('quick win')

      /* Sequencing */
      let sequencing = 0
      if (task.effort === 'deep') {
        sequencing += Math.round(12 * (remaining / req.budgetMinutes))
        if (items.length === 0) reasons.push('hardest thing first, while you have the head for it')
      }
      if (prev?.task.contexts?.includes('out') && task.contexts?.includes('out')) {
        sequencing += 20
        reasons.push('same trip')
      }
      if (task.contexts?.includes('phone')) {
        const hour = slotStart.getHours()
        if (hour < 9 || hour >= 20) sequencing -= 25
      }
      if (task.contexts?.includes('business-hours')) {
        reasons.push('has to happen while they’re open')
      }

      // Every line in the plan has to explain itself, or I won't trust the plan.
      if (reasons.length === 0) reasons.push(fitsFully ? 'fits the time you’ve got' : 'fits what’s left')

      const total = base.score + fit + momentum + sequencing
      if (best && total <= best.score) continue

      best = {
        task,
        score: total,
        item: {
          task,
          startMinute: cursor,
          minutes,
          estimateUnknown: unknown,
          partial: canPartial,
          reasons: reasons.slice(0, 2),
          breakdown: { ...base.breakdown, fit, momentum, sequencing, total },
        },
      }
    }

    if (!best) break

    items.push(best.item)
    pool.splice(pool.indexOf(best.task), 1)
    cursor += best.item.minutes
    if (best.item.minutes > BUFFER_THRESHOLD && cursor + BUFFER_MINUTES < req.budgetMinutes) {
      cursor += BUFFER_MINUTES
    }
  }

  /* A lone guessed-at task shouldn't be the whole plan — give the day a second option. */
  if (items.length === 1 && items[0].estimateUnknown && pool.length > 0) {
    const backup = pool
      .filter((t) => remainingWork(t) <= 30)
      .sort((a, b) => bases.get(b.id)!.score - bases.get(a.id)!.score)[0]
    if (backup) {
      items.push({
        task: backup,
        startMinute: cursor,
        minutes: remainingWork(backup),
        estimateUnknown: backup.estimateMinutes === undefined,
        partial: false,
        reasons: ['in case the first one is quicker than it looks'],
        breakdown: { ...bases.get(backup.id)!.breakdown, fit: 0, momentum: 0, sequencing: 0, total: bases.get(backup.id)!.score },
      })
      pool.splice(pool.indexOf(backup), 1)
      cursor += items[items.length - 1].minutes
    }
  }

  const spillover = pool.sort((a, b) => bases.get(b.id)!.score - bases.get(a.id)!.score).slice(0, 6)

  return {
    items,
    spillover,
    excluded: excluded.slice(0, 4),
    usedMinutes: items.reduce((sum, i) => sum + i.minutes, 0),
    budgetMinutes: req.budgetMinutes,
    startedAt: req.now,
  }
}

/** The single "just do this one thing" task for the home screen. */
export function heroTask(
  all: Task[],
  now = new Date(),
): { task: Task; reason: string; minutes: number; partial: boolean } | null {
  const req: PlanRequest = { budgetMinutes: 30, energy: 'normal', focusTags: [], now }
  const quick = buildPlan(all, req)
  if (quick.items.length > 0) {
    const first = quick.items[0]
    return {
      task: first.task,
      reason: first.reasons[0] ?? 'fits a spare half hour',
      minutes: first.minutes,
      partial: first.partial,
    }
  }

  const open = all.filter((t) => t.status === 'open' && !(t.snoozedUntil && t.snoozedUntil > now.toISOString()))
  if (open.length === 0) return null
  const scored = open
    .map((task) => ({ task, base: baseScore(task, req) }))
    .sort((a, b) => b.base.score - a.base.score)[0]
  return {
    task: scored.task,
    reason: scored.base.reasons[0] ?? 'top of the list',
    minutes: remainingWork(scored.task),
    partial: false,
  }
}

/** Human-readable line for a planned item, e.g. "9:00 AM – 9:45 AM". */
export function slotLabel(plan: Plan, item: PlanItem): string {
  return `${clockAt(plan.startedAt, item.startMinute)} – ${clockAt(plan.startedAt, item.startMinute + item.minutes)}`
}

export function summarizePlan(plan: Plan): string {
  if (plan.items.length === 0) return 'Nothing fits the time you’ve got.'
  return `${formatDuration(plan.usedMinutes, false)} of ${formatDuration(plan.budgetMinutes, false)}`
}
