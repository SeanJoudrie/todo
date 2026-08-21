import type { Task } from '../types'
import { addDays, nextWeekday, todayISO } from './dates'

let counter = 0
export const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

type SeedSpec = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority' | 'seed'> &
  Partial<Pick<Task, 'status' | 'priority'>>

/**
 * Real tasks, so the app is useful the second it opens and the planner has
 * something to reason about. Dates are computed at install time, not baked in.
 */
export function buildSeedTasks(now = new Date()): Task[] {
  const today = todayISO(now)
  const friday = nextWeekday(5, today)
  const monday = nextWeekday(1, today)
  const sunday = addDays(monday, -1)
  const stamp = new Date(now.getTime()).toISOString()

  const specs: SeedSpec[] = [
    {
      title: 'Move to the new place',
      notes: 'Truck, keys, and everything in boxes. This is the immovable one.',
      tags: ['house', 'home'],
      dueDate: friday,
      estimateMinutes: 720,
      estimateConfidence: 'guess',
      priority: 'critical',
      effort: 'normal',
      contexts: ['home'],
      subtasks: [
        { id: newId(), title: 'Book the truck', done: false },
        { id: newId(), title: 'Pack the kitchen', done: false },
        { id: newId(), title: 'Pack the closet', done: false },
        { id: newId(), title: 'Change address (USPS, bank, VA)', done: false },
        { id: newId(), title: 'Final walkthrough', done: false },
      ],
    },
    {
      title: 'Build + teach UCMJ class for OCS',
      notes: 'Teaching it Monday. Want the deck done Sunday so I can run through it once.',
      tags: ['army', 'career'],
      dueDate: monday,
      targetDate: sunday,
      estimateMinutes: 180,
      estimateConfidence: 'guess',
      priority: 'high',
      effort: 'deep',
      contexts: ['computer'],
      subtasks: [
        { id: newId(), title: 'Outline the articles I actually need to cover', done: false },
        { id: newId(), title: 'Build the slides', done: false },
        { id: newId(), title: 'Dry run out loud', done: false },
      ],
    },
    {
      title: 'Clean up the living room',
      tags: ['home'],
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Take the car to the mechanic',
      tags: ['admin'],
      estimateMinutes: 150,
      estimateConfidence: 'guess',
      contexts: ['out', 'business-hours'],
    },
    {
      title: 'Make a post on LinkedIn',
      tags: ['career'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['computer'],
    },
    {
      title: 'Organize photos from 2026',
      tags: ['growth', 'fun'],
      estimateMinutes: 120,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['computer'],
    },
    { title: 'Call Dad', tags: ['people'], estimateMinutes: 10, estimateConfidence: 'known', contexts: ['phone'] },
    {
      title: 'Do laundry',
      tags: ['home'],
      notes: 'Mostly waiting around — good to stack under something else.',
      estimateMinutes: 60,
      estimateConfidence: 'guess',
      effort: 'light',
      contexts: ['home'],
    },
    {
      title: 'Research healthy food / meal ideas',
      tags: ['health', 'growth'],
      estimateMinutes: 45,
      estimateConfidence: 'guess',
      effort: 'deep',
      contexts: ['computer'],
    },
    {
      title: 'Call friend and make plans to hang out',
      tags: ['people', 'fun'],
      estimateMinutes: 15,
      estimateConfidence: 'known',
      contexts: ['phone'],
    },
    {
      title: 'VA — follow up on claim status',
      tags: ['va'],
      estimateMinutes: 30,
      estimateConfidence: 'guess',
      contexts: ['phone', 'business-hours'],
    },
  ]

  return specs.map((spec) => ({
    ...spec,
    id: newId(),
    status: spec.status ?? 'open',
    priority: spec.priority ?? 'normal',
    createdAt: stamp,
    updatedAt: stamp,
    seed: true,
  }))
}
