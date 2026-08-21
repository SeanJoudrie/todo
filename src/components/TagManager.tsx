import { useState } from 'react'
import { useStore } from '../hooks'
import { Icon } from './ui'

const SWATCHES = ['#5c7332', '#26608f', '#9c5a26', '#6b4bb0', '#1f7a66', '#b5407a', '#96650d', '#2f7a3d', '#5c6070']

export function TagManager() {
  const { tags, tasks, upsertTag, removeTag, updateTask, pushToast } = useStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const countFor = (id: string) => tasks.filter((t) => t.tags.includes(id)).length

  /** Renaming onto an existing tag merges the two — that's the merge story. */
  function commitRename(from: string) {
    const to = draft.trim().toLowerCase().replace(/\s+/g, '-')
    setEditing(null)
    if (!to || to === from) return

    const merging = tags.some((t) => t.id === to)
    for (const task of tasks) {
      if (!task.tags.includes(from)) continue
      const next = task.tags.filter((t) => t !== from)
      if (!next.includes(to)) next.push(to)
      updateTask(task.id, { tags: next })
    }
    if (!merging) upsertTag({ id: to, label: to, color: tags.find((t) => t.id === from)?.color ?? '#5c6070' })
    removeTag(from)
    pushToast(merging ? `Merged into ${to}` : `Renamed to ${to}`)
  }

  return (
    <ul className="space-y-1">
      {tags.map((tag) => {
        const count = countFor(tag.id)
        return (
          <li key={tag.id} className="flex items-center gap-2 py-0.5">
            <input
              type="color"
              value={tag.color}
              onChange={(e) => upsertTag({ ...tag, color: e.target.value })}
              aria-label={`Colour for ${tag.label}`}
              list={`swatches-${tag.id}`}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-none bg-transparent p-0"
            />
            <datalist id={`swatches-${tag.id}`}>
              {SWATCHES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            {editing === tag.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitRename(tag.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(tag.id)
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="flex-1 rounded border border-line bg-surface px-1.5 py-0.5 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(tag.id)
                  setDraft(tag.label)
                }}
                className="flex-1 text-left text-sm hover:underline"
                style={{ color: tag.color }}
              >
                {tag.label}
              </button>
            )}

            <span className="text-[11px] text-faint tabular-nums">{count}</span>
            <button
              type="button"
              onClick={() => {
                removeTag(tag.id)
                pushToast(count > 0 ? `Removed the tag from ${count} tasks` : 'Tag deleted')
              }}
              aria-label={`Delete tag ${tag.label}`}
              className="text-faint hover:text-danger"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </li>
        )
      })}
      <li className="pt-1 text-[11px] text-faint">
        Rename onto an existing tag to merge them. Deleting a tag never deletes its tasks.
      </li>
    </ul>
  )
}
