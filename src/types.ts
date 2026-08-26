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

  /** IndexedDB ids, not image data. See `lib/photos.ts`. */
  photos?: string[]

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

/** Colours a tag carried under the old dark theme, remapped on load. */
export const LEGACY_TAG_COLORS: Record<string, string> = {
  '#7d9b52': '#5c7332',
  '#4f92c9': '#26608f',
  '#c97f4f': '#9c5a26',
  '#9b7fd4': '#6b4bb0',
  '#5f8fb0': '#396a86',
  '#4fb59b': '#1f7a66',
  '#e0709c': '#b5407a',
  '#e0a33e': '#96650d',
  '#5fb45f': '#2f7a3d',
  '#8d94a8': '#5c6070',
  '#a8875f': '#7a5a2e',
}

export const DEFAULT_TAGS: TagDef[] = [
  { id: 'army', label: 'army', color: '#5c7332' },
  { id: 'va', label: 'va', color: '#26608f' },
  { id: 'house', label: 'house', color: '#9c5a26' },
  { id: 'career', label: 'career', color: '#6b4bb0' },
  { id: 'current-job', label: 'current-job', color: '#396a86' },
  { id: 'money', label: 'money', color: '#0f6b7a' },
  { id: 'content', label: 'content', color: '#8f3a9e' },
  { id: 'growth', label: 'growth', color: '#1f7a66' },
  { id: 'fun', label: 'fun', color: '#b5407a' },
  { id: 'people', label: 'people', color: '#96650d' },
  { id: 'health', label: 'health', color: '#2f7a3d' },
  { id: 'home', label: 'home', color: '#5c6070' },
  { id: 'admin', label: 'admin', color: '#7a5a2e' },
]
