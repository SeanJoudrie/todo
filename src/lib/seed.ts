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
export const SEED_VERSION = 2

type SeedSpec = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority' | 'seed' | 'subtasks'> &
  Partial<Pick<Task, 'status' | 'priority'>> & { steps?: string[] }

const SUGGESTED = 'Suggested — not something you said, added because it follows from what you did say.'

function specs(today: string): SeedSpec[] {
  return [
    /* ------------------------------ right now ------------------------------ */
    {
      title: 'Follow up with the employer who said Thursday',
      notes:
        'They said Thursday, it went quiet, and you have been chewing on it. A short warm email asking where things ' +
        'landed is normal and costs you nothing.',
      tags: ['career'],
      dueDate: today,
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      priority: 'critical',
      pinned: true,
      effort: 'deep',
      contexts: ['computer', 'business-hours'],
    },

    /* -------------------------------- army --------------------------------- */
    {
      title: 'Reapply for the military grant',
      notes: 'Missed the signing window on a document last time. Find the new deadline first — that decides everything else.',
      tags: ['army', 'money'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
      steps: ['Find out which document was missed', 'Find out the new deadline', 'Get it signed', 'Submit'],
    },
    {
      title: 'Call about the blocked army forms',
      notes: "You can't fill them in — they're blocked. One call to the right person unblocks a whole pile.",
      tags: ['army'],
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
      tags: ['army', 'health'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Organize military gear',
      tags: ['army', 'home'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Buy the missing army gear',
      notes: 'Underwear, socks, whatever else is short.',
      tags: ['army', 'money'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Update address with the unit after the move',
      notes: `${SUGGESTED} Easy to forget in a move, annoying when it bites.`,
      tags: ['army', 'admin'],
      estimateMinutes: 15,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Check whether you qualify for anything through the VA',
      notes:
        `${SUGGESTED} Guard service can open VA healthcare or a claim depending on your status and orders. ` +
        'Given the exhaustion with no answer, worth an hour to find out rather than assume.',
      tags: ['va', 'health'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Look into full-time Guard positions (AGR / Title 32 technician)',
      notes:
        `${SUGGESTED} You joined partly for work. These are real full-time jobs inside the org you are already in, ` +
        'and they are not posted where you have been looking.',
      tags: ['army', 'career'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },

    /* ------------------------------ job search ----------------------------- */
    {
      title: 'Talk to Jackson about a job there',
      tags: ['career', 'people'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['phone'],
    },
    {
      title: 'Apply through veteran-preference channels (federal + state)',
      notes:
        `${SUGGESTED} You have put ~1000 hours into one channel. This is a different channel, not more hours in the ` +
        'same one — veteran preference on USAJOBS and state listings is a real, underused edge.',
      tags: ['career'],
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Look into SkillBridge / veteran hiring programs',
      notes: SUGGESTED,
      tags: ['career'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Decide a weekly cap on job-search hours',
      notes:
        `${SUGGESTED} Eight to twelve hours a day for a year and a half with this little back is not a discipline ` +
        'problem, it is a burnout problem. A cap protects the hours you would spend on the app and the content.',
      tags: ['career', 'health'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      effort: 'deep',
    },

    /* --------------------------------- car --------------------------------- */
    {
      title: 'Get the car diagnosed',
      notes: "You don't know what's wrong yet — a diagnostic is the actual first step and it's cheap. Repair is separate.",
      tags: ['admin'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['out', 'business-hours'],
    },
    {
      title: 'Get the car repaired',
      notes: 'Blocked until the diagnosis. Cost unknown until then.',
      tags: ['admin', 'money'],
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      contexts: ['out', 'business-hours'],
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

    /* -------------------------------- money -------------------------------- */
    {
      title: 'Do the food stamps paperwork',
      notes: 'Find the deadline first — recertification windows are unforgiving.',
      tags: ['money', 'admin'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Report the address change to SNAP and Section 8',
      notes:
        `${SUGGESTED} This one matters. Moving units means both have to be told, usually within a set number of days. ` +
        'Missing it causes real problems later, and it is exactly the kind of thing that slips during a move.',
      tags: ['money', 'house', 'admin'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      priority: 'high',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Call AMC about the missing veteran discount',
      notes: 'Charged $40 instead of the discounted price, which triggered the overdraft.',
      tags: ['money', 'admin'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
      contexts: ['phone'],
    },
    {
      title: 'Ask the bank to reverse the overdraft fee',
      notes: `${SUGGESTED} Banks routinely waive a first overdraft fee if you call and ask. One call.`,
      tags: ['money'],
      estimateMinutes: 15,
      estimateConfidence: 'guess',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Figure out what the $30k is actually for',
      notes:
        `${SUGGESTED} Do this before hiring anyone. Emergency fund, moving costs, washer/dryer, LA trip, runway while ` +
        'job hunting — splitting it into named buckets is most of what an advisor does in the first meeting anyway.',
      tags: ['money'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
    },
    {
      title: 'Find a financial advisor',
      notes: 'Ask specifically for fee-only / fiduciary. Military OneSource also offers free financial counseling.',
      tags: ['money'],
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Audit the bills for savings programs',
      notes:
        'You used something like the Affordable Connectivity Program before. Check what replaced it, plus Lifeline, ' +
        'utility hardship rates, and any veteran or low-income discounts your providers run.',
      tags: ['money', 'admin'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Cancel subscriptions you are not using',
      notes: SUGGESTED,
      tags: ['money'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Save up for the LA trip to see your friend',
      notes: 'Price it out so it becomes a number instead of a someday.',
      tags: ['money', 'fun', 'people'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
    },

    /* ------------------------------ the move ------------------------------- */
    {
      title: 'Move downstairs',
      tags: ['house', 'home'],
      estimateMinutes: 600,
      estimateConfidence: 'guess',
      priority: 'critical',
      contexts: ['home'],
      steps: [
        'Purge before packing — one bedroom less means less fits',
        'Pack the kitchen',
        'Pack the closet',
        'Change address: USPS, bank, unit, SNAP, Section 8',
        'Final walkthrough of the old unit',
      ],
    },
    {
      title: 'Find out where you actually stand with the lease change',
      notes:
        `${SUGGESTED} You said you cannot fight it because of the roommate, and that may well be right — but a free ` +
        'tenant-rights or legal-aid consult is confidential and would tell you your actual exposure instead of you ' +
        'guessing. Worth an hour even if the answer is to let it go.',
      tags: ['house', 'admin'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['phone'],
    },
    {
      title: 'Get rid of a big chunk of your stuff',
      notes: 'You said it yourself — too much stuff, and you are losing a bedroom. Do this before packing, not after.',
      tags: ['home'],
      estimateMinutes: 240,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Buy a washer and dryer',
      notes: 'Check the hookups and the space in the new unit before buying anything.',
      tags: ['home', 'money'],
      estimateMinutes: 90,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Set up the designated spots in the new place',
      notes: 'One spot to work, one to train, one to actually rest. Decide on move-in day, before habits form on their own.',
      tags: ['home', 'growth'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['home'],
    },
    {
      title: 'Get renters insurance for the new unit',
      notes: `${SUGGESTED} Usually cheap, and often required.`,
      tags: ['home', 'admin', 'money'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Keep the new place clean — daily reset',
      notes: 'The habit you said you want. Fifteen minutes a day beats a four-hour blowout on a Saturday.',
      tags: ['home'],
      estimateMinutes: 15,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },

    /* ------------------------------- content ------------------------------- */
    {
      title: 'Pick ONE series and start it',
      notes:
        'You have two ideas and the fork is what is stopping you. The community-built app series is the more ' +
        'distinctive one — nobody else can make it, it shows your actual work, and it has a built-in reason to comment. ' +
        'The yapping series is easier to sustain. Pick one, post three, then decide. Do not decide first.',
      tags: ['content', 'growth'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      steps: ['Pick the one to start with', 'Write three video ideas', 'Record all three in one sitting'],
    },
    {
      title: 'Set up the Instagram account for the content',
      tags: ['content'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Post the first three videos',
      notes:
        'Being perceived by people you knew seven years ago is the actual blocker, not the filming. Three posts is the ' +
        'smallest number that tells you anything real.',
      tags: ['content'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      effort: 'deep',
    },
    {
      title: 'Build the community-request app (white screen v0)',
      notes:
        'Blank white screen, people request features, you add them and it gets progressively unhinged. This is a good ' +
        'idea. The v0 is genuinely just a white screen and a deploy — ship that before it grows.',
      tags: ['content', 'career', 'growth'],
      estimateMinutes: 240,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Set a posting schedule you can actually hold',
      notes:
        `${SUGGESTED} Your own pattern is post-a-lot then post-nothing. A floor you can hit on a bad week beats a ` +
        'target you abandon.',
      tags: ['content'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
    },
    {
      title: 'Work on your app',
      tags: ['career', 'growth'],
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Write your book',
      notes: 'Long-running. Worth breaking into something smaller once you know the shape of it.',
      tags: ['growth'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      effort: 'deep',
    },

    /* -------------------------------- health ------------------------------- */
    {
      title: 'Follow up on the exhaustion — push for actual answers',
      notes:
        `${SUGGESTED} "No answer" usually means the obvious panel was not run. Ask specifically about thyroid (TSH), ` +
        'ferritin/iron, vitamin D, B12, A1c, and a sleep apnea screen. Being deathly exhausted every day is a symptom, ' +
        'not a personality trait.',
      tags: ['health'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['phone', 'business-hours'],
    },
    {
      title: 'Work out',
      notes:
        'You ruck 12 miles under load without training for it — you are not lazy, you are undertrained and running on ' +
        'empty. Two short sessions a week you actually do beats a daily plan you do not.',
      tags: ['health'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
    },
    {
      title: 'Eat breakfast',
      notes: 'You skip it because you are hungry, which is worth noticing. Something small and automatic.',
      tags: ['health'],
      estimateMinutes: 10,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Sort out a sleep schedule',
      notes: `${SUGGESTED} Relevant to the exhaustion, and free to try before any appointment.`,
      tags: ['health'],
      estimateMinutes: 20,
      estimateConfidence: 'guess',
    },

    /* -------------------------------- people ------------------------------- */
    {
      title: "Talk to Sarah's dad",
      tags: ['people'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['phone'],
    },
    {
      title: 'Reply to the messages you fell behind on',
      notes: `${SUGGESTED} You said you have a backlog. One sitting, no apologies required.`,
      tags: ['people'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      effort: 'light',
    },

    /* ------------------------------- wardrobe ------------------------------ */
    {
      title: 'Sell a bunch of your clothes',
      notes: 'Pairs with the purge before the move.',
      tags: ['home', 'money'],
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Build the new wardrobe',
      notes: 'The uniform you described: ~10 college shirts, ~10 suit jackets, ~10 sweaters. Same thing, different variety.',
      tags: ['admin', 'money'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },

    /* ------------------------------- someday ------------------------------- */
    {
      title: 'Get out of Wakefield',
      notes: 'Downstream of income. Parked here on purpose so it stops feeling like a daily failure.',
      tags: ['house', 'growth'],
      status: 'someday',
      effort: 'deep',
    },
    {
      title: 'Figure out the digital-nomad version of this',
      notes: 'Guard service constrains it, it does not kill it. Worth revisiting once there is income.',
      tags: ['growth', 'fun'],
      status: 'someday',
      effort: 'deep',
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
export function shouldReseed(tasks: Task[], installedVersion: number): boolean {
  if (installedVersion >= SEED_VERSION) return false
  if (tasks.length === 0) return false
  return tasks.every((t) => t.seed && t.status !== 'done' && !t.completedAt && t.updatedAt === t.createdAt)
}
