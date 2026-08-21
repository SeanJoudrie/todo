import type { Energy, Task, TagDef } from '../types'
import { DEFAULT_TAGS } from '../types'

const STATE_KEY = 'todo.state.v1'
const SNAPSHOT_KEY = 'todo.snapshots.v1'
const MAX_SNAPSHOTS = 10
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

export type Settings = {
  lastBudget: number
  lastEnergy: Energy
  lastFocusTags: string[]
  seedInstalled: boolean
}

export type AppState = {
  version: 1
  tasks: Task[]
  tags: TagDef[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  lastBudget: 240,
  lastEnergy: 'normal',
  lastFocusTags: [],
  seedInstalled: false,
}

export function emptyState(): AppState {
  return { version: 1, tasks: [], tags: DEFAULT_TAGS, settings: DEFAULT_SETTINGS }
}

/** Storage is best-effort: a private window or a full disk must not break the app. */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadState(): AppState {
  const raw = readRaw(STATE_KEY)
  if (!raw) return emptyState()
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : DEFAULT_TAGS,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): boolean {
  const ok = writeRaw(STATE_KEY, JSON.stringify(state))
  if (ok) maybeSnapshot(state)
  return ok
}

/* -------------------------------------------------------------------------- */
/* Rolling snapshots — cheap insurance against a bad edit or a bad import      */
/* -------------------------------------------------------------------------- */

export type Snapshot = { at: string; taskCount: number; state: AppState }

export function listSnapshots(): Snapshot[] {
  const raw = readRaw(SNAPSHOT_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Snapshot[]
  } catch {
    return []
  }
}

function maybeSnapshot(state: AppState) {
  const snaps = listSnapshots()
  const last = snaps[0]
  if (last && Date.now() - new Date(last.at).getTime() < SNAPSHOT_INTERVAL_MS) return
  const next = [{ at: new Date().toISOString(), taskCount: state.tasks.length, state }, ...snaps].slice(
    0,
    MAX_SNAPSHOTS,
  )
  writeRaw(SNAPSHOT_KEY, JSON.stringify(next))
}

/* -------------------------------------------------------------------------- */
/* Export / import                                                            */
/* -------------------------------------------------------------------------- */

export function exportJSON(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export function exportMarkdown(tasks: Task[]): string {
  const open = tasks.filter((t) => t.status === 'open')
  const done = tasks.filter((t) => t.status === 'done')
  const line = (t: Task) => {
    const bits = [t.tags.join(', '), t.dueDate && `due ${t.dueDate}`, t.estimateMinutes && `~${t.estimateMinutes}m`]
      .filter(Boolean)
      .join(' · ')
    return `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${bits ? `  _(${bits})_` : ''}`
  }
  return [`# Todo`, ``, `## Open (${open.length})`, ...open.map(line), ``, `## Done (${done.length})`, ...done.map(line)].join(
    '\n',
  )
}

export type ImportResult = { ok: true; state: AppState } | { ok: false; error: string }

export function parseImport(text: string): ImportResult {
  try {
    const parsed = JSON.parse(text) as Partial<AppState>
    if (!Array.isArray(parsed.tasks)) return { ok: false, error: 'No tasks array in that file.' }
    const tasks = parsed.tasks.filter((t): t is Task => Boolean(t && typeof t.id === 'string' && typeof t.title === 'string'))
    if (tasks.length === 0) return { ok: false, error: 'That file has no usable tasks.' }
    return {
      ok: true,
      state: {
        version: 1,
        tasks,
        tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : DEFAULT_TAGS,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      },
    }
  } catch {
    return { ok: false, error: "That doesn't look like JSON." }
  }
}

export function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
