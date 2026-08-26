import { createContext } from 'react'
import type { Subtask, TagDef, Task } from './types'
import type { AppState, Settings } from './lib/storage'

export type Toast = { id: string; message: string; undo?: () => void }

export type Store = {
  tasks: Task[]
  tags: TagDef[]
  settings: Settings
  storageOk: boolean
  fullState: AppState

  addTask: (title: string, patch?: Partial<Task>) => Task
  addMany: (titles: string[]) => Task[]
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  setDone: (id: string, done: boolean) => void
  togglePin: (id: string) => void
  snooze: (id: string, until: Date) => void

  attachPhoto: (taskId: string, photoId: string) => void
  detachPhoto: (taskId: string, photoId: string) => void

  addSubtask: (taskId: string, title: string) => void
  updateSubtask: (taskId: string, subId: string, patch: Partial<Subtask>) => void
  removeSubtask: (taskId: string, subId: string) => void

  upsertTag: (tag: TagDef) => void
  removeTag: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (state: AppState) => void
  clearSeed: () => void
  loadLatestSeed: () => { added: number; removed: number }
  resetEverything: () => void

  toasts: Toast[]
  pushToast: (message: string, undo?: () => void) => void
  dismissToast: (id: string) => void
}

export const StoreContext = createContext<Store | null>(null)
