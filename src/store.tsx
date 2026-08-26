import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Subtask, Task } from './types'
import { DEFAULT_TAGS } from './types'
import { applyLog, backfillLog, rebuildLog, recordDone, recordUndone } from './lib/completions'
import { buildSeedTasks, newId, refreshSeed, SEED_VERSION, shouldReseed } from './lib/seed'
import { loadState, saveState, type AppState } from './lib/storage'

import { StoreContext, type Store, type Toast } from './store-context'

function withSeed(state: AppState): AppState {
  // Adopt anything already finished before this record existed, so existing
  // completions get the same protection as new ones.
  backfillLog(state.tasks)

  const fresh = !state.settings.seedInstalled && state.tasks.length === 0
  const seeded =
    !fresh && !shouldReseed(state.tasks, state.settings.seedVersion)
      ? state
      : {
          ...state,
          tasks: buildSeedTasks(),
          settings: { ...state.settings, seedInstalled: true, seedVersion: SEED_VERSION },
        }

  // Whatever the list turned out to be, anything already finished stays finished.
  return { ...seeded, tasks: applyLog(seeded.tasks).tasks }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => withSeed(loadState()))
  const [storageOk, setStorageOk] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, number>>({})

  // Persist on every change. Only re-render when the storage health actually
  // flips, otherwise every keystroke would cost an extra render.
  const storageOkRef = useRef(true)
  useEffect(() => {
    const ok = saveState(state)
    if (storageOkRef.current !== ok) {
      storageOkRef.current = ok
      setStorageOk(ok)
    }
  }, [state])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    window.clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const pushToast = useCallback(
    (message: string, undo?: () => void) => {
      const id = newId()
      setToasts((t) => [...t.slice(-2), { id, message, undo }])
      timers.current[id] = window.setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of Object.values(pending)) window.clearTimeout(t)
    }
  }, [])

  const store = useMemo<Store>(() => {
    const mutate = (fn: (tasks: Task[]) => Task[]) => setState((s) => ({ ...s, tasks: fn(s.tasks) }))
    const stamp = () => new Date().toISOString()

    const patchTask = (id: string, patch: Partial<Task>) =>
      mutate((tasks) => tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: stamp() } : t)))

    const makeTask = (title: string, patch: Partial<Task> = {}): Task => {
      const now = stamp()
      return {
        id: newId(),
        title,
        tags: [],
        status: 'open',
        priority: 'normal',
        createdAt: now,
        updatedAt: now,
        ...patch,
      }
    }

    return {
      tasks: state.tasks,
      tags: state.tags,
      settings: state.settings,
      storageOk,
      fullState: state,

      addTask(title, patch) {
        const task = makeTask(title, patch)
        mutate((tasks) => [task, ...tasks])
        return task
      },

      addMany(titles) {
        const created = titles.map((t) => makeTask(t))
        mutate((tasks) => [...created, ...tasks])
        return created
      },

      updateTask: patchTask,

      removeTask(id) {
        // A deliberate delete also forgets the completion, so it is never
        // resurrected later by the record.
        const task = state.tasks.find((t) => t.id === id)
        if (task) recordUndone(task.title)
        mutate((tasks) => tasks.filter((t) => t.id !== id))
      },

      setDone(id, done) {
        const task = state.tasks.find((t) => t.id === id)
        const at = stamp()
        // Written straight to storage first, so a reload a split second later
        // still knows this was finished even if nothing else got saved.
        if (task) {
          if (done) recordDone(task.title, at)
          else recordUndone(task.title)
        }
        patchTask(id, done ? { status: 'done', completedAt: at } : { status: 'open', completedAt: undefined })
      },

      togglePin(id) {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, pinned: !t.pinned, updatedAt: stamp() } : t)),
        }))
      },

      snooze(id, until) {
        patchTask(id, { snoozedUntil: until.toISOString() })
      },

      attachPhoto(taskId, photoId) {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, photos: [...(t.photos ?? []), photoId], updatedAt: stamp() } : t,
          ),
        }))
      },

      detachPhoto(taskId, photoId) {
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, photos: (t.photos ?? []).filter((p) => p !== photoId), updatedAt: stamp() } : t,
          ),
        }))
      },

      addSubtask(taskId, title) {
        patchTaskSubtasks(taskId, (subs) => [...subs, { id: newId(), title, done: false }])
      },

      updateSubtask(taskId, subId, patch) {
        patchTaskSubtasks(taskId, (subs) => subs.map((s) => (s.id === subId ? { ...s, ...patch } : s)))
      },

      removeSubtask(taskId, subId) {
        patchTaskSubtasks(taskId, (subs) => subs.filter((s) => s.id !== subId))
      },

      upsertTag(tag) {
        setState((s) => ({
          ...s,
          tags: s.tags.some((t) => t.id === tag.id) ? s.tags.map((t) => (t.id === tag.id ? tag : t)) : [...s.tags, tag],
        }))
      },

      removeTag(id) {
        setState((s) => ({
          ...s,
          tags: s.tags.filter((t) => t.id !== id),
          // Deleting a tag must never delete the tasks wearing it.
          tasks: s.tasks.map((t) => (t.tags.includes(id) ? { ...t, tags: t.tags.filter((x) => x !== id) } : t)),
        }))
      },

      setSettings(patch) {
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
      },

      replaceAll(next) {
        rebuildLog(next.tasks)
        setState(next)
      },

      loadLatestSeed() {
        const result = refreshSeed(state.tasks)
        const restored = applyLog(result.tasks).tasks
        setState((s) => ({
          ...s,
          tasks: restored,
          settings: { ...s.settings, seedInstalled: true, seedVersion: SEED_VERSION },
        }))
        return { added: result.added, removed: result.removed }
      },

      clearSeed() {
        mutate((tasks) => tasks.filter((t) => !t.seed))
      },

      resetEverything() {
        setState({ version: 1, tasks: [], tags: DEFAULT_TAGS, settings: { ...state.settings, seedInstalled: true } })
      },

      toasts,
      pushToast,
      dismissToast,
    }

    function patchTaskSubtasks(taskId: string, fn: (subs: Subtask[]) => Subtask[]) {
      mutate((tasks) =>
        tasks.map((t) => (t.id === taskId ? { ...t, subtasks: fn(t.subtasks ?? []), updatedAt: stamp() } : t)),
      )
    }
  }, [state, storageOk, toasts, pushToast, dismissToast])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
