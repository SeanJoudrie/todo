export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type Status = 'open' | 'done' | 'waiting' | 'someday'
export type Effort = 'light' | 'normal' | 'deep'
export type TaskContext = 'home' | 'out' | 'phone' | 'computer' | 'business-hours'
export type Energy = 'fried' | 'normal' | 'sharp'

export type Subtask = {
  id: string
  title: string
  done: boolean
}

export type Task = {
  id: string
  title: string
  notes?: string
  tags: string[]
  status: Status

  /** Hard deadline — real-world consequence if missed. `YYYY-MM-DD`, local. */
  dueDate?: string
  /** Soft target — when I want it done so I'm not scrambling. `YYYY-MM-DD`, local. */
  targetDate?: string

  estimateMinutes?: number
  estimateConfidence?: 'guess' | 'known'

  priority: Priority
  pinned?: boolean
  effort?: Effort
  contexts?: TaskContext[]

  subtasks?: Subtask[]

  createdAt: string
  updatedAt: string
  completedAt?: string
  /** ISO timestamp. Set by "not today" in the planner. */
  snoozedUntil?: string

  /** Shipped with the app rather than captured by me. Lets "clear seed data" work. */
  seed?: boolean
}

export type TagDef = {
  id: string
  label: string
  color: string
}

export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'critical']
export const EFFORTS: Effort[] = ['light', 'normal', 'deep']
export const CONTEXTS: TaskContext[] = ['home', 'out', 'phone', 'computer', 'business-hours']

export const CONTEXT_LABELS: Record<TaskContext, string> = {
  home: 'at home',
  out: 'out / errand',
  phone: 'phone call',
  computer: 'at a computer',
  'business-hours': 'business hours',
}

export const DEFAULT_TAGS: TagDef[] = [
  { id: 'army', label: 'army', color: '#7d9b52' },
  { id: 'va', label: 'va', color: '#4f92c9' },
  { id: 'house', label: 'house', color: '#c97f4f' },
  { id: 'career', label: 'career', color: '#9b7fd4' },
  { id: 'current-job', label: 'current-job', color: '#5f8fb0' },
  { id: 'growth', label: 'growth', color: '#4fb59b' },
  { id: 'fun', label: 'fun', color: '#e0709c' },
  { id: 'people', label: 'people', color: '#e0a33e' },
  { id: 'health', label: 'health', color: '#5fb45f' },
  { id: 'home', label: 'home', color: '#8d94a8' },
  { id: 'admin', label: 'admin', color: '#a8875f' },
]
