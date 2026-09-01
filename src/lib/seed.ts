import type { Task } from '../types'
import { todayISO } from './dates'

let counter = 0
export const newId = () =>
  `t${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Bump when the shipped list below changes. An untouched install picks up the
 * new list on next open; anything you've actually used is left alone.
 * See `shouldReseed`.
 */
export const SEED_VERSION = 5

type SeedSpec = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority' | 'seed' | 'subtasks'> &
  Partial<Pick<Task, 'status' | 'priority'>> & { steps?: string[] }

const SUGGESTED = 'Suggested — not something you said, added because it follows from what you did say.'

function specs(today: string): SeedSpec[] {
  return [
    /* ------------------------- the two recertifications ------------------------- */
    {
      title: 'Recertify Section 8 housing',
      notes:
        'The one with a real cliff at the end of it — miss the window and the voucher can be terminated. ' +
        'Call the housing authority first and get the recert date out of them; if they mailed the packet and it ' +
        'never landed, ask them to resend it today. Then the paperwork is just paperwork.',
      tags: ['house', 'money', 'admin'],
      targetDate: today,
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      priority: 'critical',
      pinned: true,
      effort: 'deep',
      contexts: ['phone', 'business-hours'],
      steps: [
        'Call and ask for the recert date',
        'Ask them to resend the packet if it never arrived',
        'Gather income proof, ID, SSN cards',
        'Hand it in and get confirmation it was received',
      ],
    },
    {
      title: 'Recertify food stamps (SNAP)',
      notes:
        'Same shape as the housing one: the deadline decides everything, so find it before you touch a form. If they ' +
        'already sent a notice the date is printed on it. Usually an interview plus proof of income.',
      tags: ['money', 'admin'],
      targetDate: today,
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'critical',
      pinned: true,
      effort: 'deep',
      contexts: ['phone', 'business-hours'],
      steps: [
        'Find the recert deadline',
        'Book the interview',
        'Gather income proof',
        'Submit before the date',
      ],
    },

    /* --------------------------------- calls ---------------------------------- */
    {
      title: 'Call about the blocked army forms',
      notes: "You can't fill them in — they're blocked. One call to the right person unblocks a whole pile.",
      tags: ['army', 'admin'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Call Military OneSource back',
      notes:
        'They already called you. Worth knowing: OneSource includes free confidential non-medical counseling and ' +
        'financial counseling, separate from anything that touches your record.',
      tags: ['army', 'health', 'money'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Reapply for the military grant',
      notes: 'Missed the signing window on a document last time. Find the new deadline first — that decides everything else.',
      tags: ['army', 'money', 'admin'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
      steps: ['Find out which document was missed', 'Find out the new deadline', 'Get it signed', 'Submit'],
    },
    {
      title: 'Get the car diagnosed',
      notes: "You don't know what's wrong yet — a diagnostic is the actual first step and it's cheap. Repair is separate.",
      tags: ['admin', 'money'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['out', 'business-hours'],
    },
    {
      title: 'Check whether you qualify for anything through the VA',
      notes:
        `${SUGGESTED} Guard service can open VA healthcare or a claim depending on your status and orders. ` +
        'An hour to find out beats assuming.',
      tags: ['va', 'health', 'money'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Apply through veteran-preference channels (federal + state)',
      notes:
        `${SUGGESTED} A different channel, not more hours in the same one — veteran preference on USAJOBS and state ` +
        'listings is real and underused. First step is finding which preference category you qualify for; that ' +
        'determines everything after it.',
      tags: ['career', 'army'],
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Call AMC about the missing veteran discount',
      notes: 'Charged $40 instead of the discounted price, which is what triggered the overdraft.',
      tags: ['money', 'admin', 'army'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      contexts: ['phone'],
    },
    {
      title: 'Sort out the cracked windshield',
      notes:
        'Insurance said no. Two things to check: whether your state has a zero-deductible glass law, and mobile glass ' +
        'services, which are usually far cheaper than a shop.',
      tags: ['admin', 'money'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      contexts: ['phone'],
    },
    {
      title: "Talk to Sarah's dad",
      notes: 'Add what it is about while you still remember, or this becomes a line you cannot decode in three weeks.',
      tags: ['people', 'admin'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['phone'],
    },
    {
      title: 'Buy the missing army gear',
      notes: 'Underwear, socks, whatever else is short.',
      tags: ['army', 'money', 'admin'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },

    /* -------------------------------- blocked --------------------------------- */
    {
      title: 'Get the car repaired',
      notes:
        'Blocked: nothing to book until the diagnosis says what is wrong, and the cost is unknowable until then. ' +
        'Flip this back to open the moment you have the diagnosis.',
      status: 'waiting',
      tags: ['admin', 'money'],
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      contexts: ['out', 'business-hours'],
    },

    /* ------------------------- parked, not deleted ---------------------------- */
    {
      title: 'Audit the bills for savings programs',
      status: 'someday',
      notes:
        'Parked while the recerts are live. You used something like the Affordable Connectivity Program before — ' +
        'check what replaced it, plus Lifeline, utility hardship rates, and veteran discounts.',
      tags: ['money', 'admin', 'home'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Cancel subscriptions you are not using',
      status: 'someday',
      notes: 'Parked. Half an hour whenever you want a cheap win.',
      tags: ['money', 'admin'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Find a financial advisor',
      status: 'someday',
      notes: 'Parked. When you come back to it: ask specifically for fee-only / fiduciary. OneSource does it free.',
      tags: ['money', 'admin'],
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Sell a bunch of your clothes',
      status: 'someday',
      notes: 'Parked. Money, but slow money — not while the recerts are open.',
      tags: ['home', 'money'],
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Work out',
      status: 'someday',
      notes:
        'Parked. You ruck 12 miles under load without training for it — two short sessions a week you actually do ' +
        'beats a daily plan you do not.',
      tags: ['health', 'army'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
    },
    {
      title: 'Eat breakfast',
      status: 'someday',
      notes: 'Parked. You skip it because you are hungry, which is worth noticing. Something small and automatic.',
      tags: ['health', 'home'],
      estimateMinutes: 10,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Sort out a sleep schedule',
      status: 'someday',
      notes: 'Parked. Relevant to the exhaustion, and free to try.',
      tags: ['health', 'growth'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
    },
  ]
}

export function buildSeedTasks(now = new Date()): Task[] {
  const stamp = now.toISOString()
  return specs(todayISO(now)).map(({ steps, ...spec }) => ({
    ...spec,
    id: newId(),
    status: spec.status ?? 'open',
    priority: spec.priority ?? 'normal',
    ...(steps ? { subtasks: steps.map((title) => ({ id: newId(), title, done: false })) } : {}),
    createdAt: stamp,
    updatedAt: stamp,
    seed: true,
  }))
}

/**
 * Should a stored list be replaced by a newer shipped one?
 *
 * Only when every task is still exactly as it shipped — nothing added, nothing
 * ticked off, nothing edited. The moment the list has been used it belongs to
 * the user and is never overwritten.
 */
/** Anything the owner has actually engaged with. Never touched by a refresh. */
function isOwnWork(t: Task): boolean {
  return !t.seed || t.status === 'done' || Boolean(t.completedAt) || t.updatedAt !== t.createdAt
}

const normalise = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export type SeedRefresh = { tasks: Task[]; added: number; removed: number; kept: number }

/**
 * Pull in the current shipped list without destroying anything.
 *
 * Everything the owner added, completed or edited is kept. Only sample tasks
 * still exactly as they shipped are cleared out, and shipped tasks whose title
 * is already present are skipped, so nothing is duplicated.
 *
 * This is the escape hatch for an install where `shouldReseed` will never fire
 * again — one completed task is enough to lock a list on an old version.
 */
export function refreshSeed(existing: Task[], now = new Date()): SeedRefresh {
  const shipped = buildSeedTasks(now)
  const shippedTitles = new Set(shipped.map((t) => normalise(t.title)))

  // Keep the owner's work, and keep untouched tasks that are still part of the
  // current list — recreating those would churn their ids for no reason and
  // make a second run look like a big destructive change.
  const kept = existing.filter((t) => isOwnWork(t) || shippedTitles.has(normalise(t.title)))
  const keptTitles = new Set(kept.map((t) => normalise(t.title)))
  const incoming = shipped.filter((t) => !keptTitles.has(normalise(t.title)))

  return {
    tasks: [...incoming, ...kept],
    added: incoming.length,
    removed: existing.length - kept.length,
    kept: kept.length,
  }
}

export function shouldReseed(tasks: Task[], installedVersion: number): boolean {
  if (installedVersion >= SEED_VERSION) return false
  if (tasks.length === 0) return false
  return tasks.every((t) => t.seed && t.status !== 'done' && !t.completedAt && t.updatedAt === t.createdAt)
}
