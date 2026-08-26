import type { Energy, Task, TagDef } from '../types'
import { DEFAULT_TAGS, LEGACY_TAG_COLORS } from '../types'

const STATE_KEY = 'todo.state.v1'
/**
 * Deliberately outside AppState so it never rides along in an exported backup.
 * A key in a file you share or sync is a key you've leaked.
 */
const API_KEY_KEY = 'todo.apikey.v1'
const SNAPSHOT_KEY = 'todo.snapshots.v1'
const MAX_SNAPSHOTS = 10
const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000

export type Settings = {
  lastBudget: number
  lastEnergy: Energy
  lastFocusTags: string[]
  seedInstalled: boolean
  /** Which shipped starting list this install has. See `shouldReseed`. */
  seedVersion: number
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
  seedVersion: 0,
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

/** Lift tags saved under the old dark palette to their light-theme equivalents. */
function migrateTagColors(tags: TagDef[]): TagDef[] {
  return tags.map((tag) => {
    const next = LEGACY_TAG_COLORS[tag.color.toLowerCase()]
    return next ? { ...tag, color: next } : tag
  })
}

export function loadState(): AppState {
  const raw = readRaw(STATE_KEY)
  if (!raw) return emptyState()
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      tags:
        Array.isArray(parsed.tags) && parsed.tags.length > 0 ? migrateTagColors(parsed.tags) : DEFAULT_TAGS,
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

export function loadApiKey(): string {
  return readRaw(API_KEY_KEY) ?? ''
}

export function saveApiKey(key: string) {
  const trimmed = key.trim()
  if (trimmed) writeRaw(API_KEY_KEY, trimmed)
  else {
    try {
      localStorage.removeItem(API_KEY_KEY)
    } catch {
      /* nothing we can do, and nothing that should break the app */
    }
  }
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

export type SaveOutcome = 'saved' | 'declined' | 'failed'

type ClaudeHost = { use?: (name: string) => Promise<unknown> }
type Downloads = { save: (req: { filename: string; data: string }) => Promise<unknown> }

/**
 * Hand the user a file.
 *
 * Inside a published Artifact a plain `<a download>` is inert — the viewer
 * mediates saves — so try that route first and fall back to the anchor for
 * ordinary hosting.
 */
export async function download(filename: string, contents: string, mime: string): Promise<SaveOutcome> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    try {
      const downloads = (await host.use('downloads')) as Downloads | null
      if (downloads) {
        await downloads.save({ filename, data: contents })
        return 'saved'
      }
    } catch (error) {
      return (error as { code?: string })?.code === 'declined' ? 'declined' : 'failed'
    }
  }

  try {
    const blob = new Blob([contents], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return 'saved'
  } catch {
    return 'failed'
  }
}

/** Last-resort backup route that works absolutely everywhere. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
