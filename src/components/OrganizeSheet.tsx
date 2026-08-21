import { useState } from 'react'
import type { Task } from '../types'
import { formatDate, formatDuration, todayISO } from '../lib/dates'
import { AiUnavailable, organizeWithClaude } from '../lib/ai'
import { organizeLocally, type Draft } from '../lib/organize'
import { loadApiKey } from '../lib/storage'
import { useStore } from '../hooks'
import { Icon, Pill, Sheet } from './ui'

const PLACEHOLDER = `Talk. Don't organize it, that's the point.

"ok so I gotta move next Friday, and I have to teach my UCMJ class Monday but I want it done by Sunday, also take the car in probably 2-3 hours, and call dad"`

/** Unmounting when closed is what resets the draft state — no effect needed. */
export function OrganizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <OrganizeBody onClose={onClose} />
}

function OrganizeBody({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const { tags, addTask, removeTask, pushToast } = store
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function organize() {
    if (!text.trim()) return
    setBusy(true)
    setNote(null)

    const key = loadApiKey()
    if (key) {
      try {
        setDrafts(await organizeWithClaude(text, key, tags))
        setBusy(false)
        return
      } catch (error) {
        // Never let the smart path being down mean no result at all.
        setNote(
          `${error instanceof AiUnavailable ? error.message : 'Claude was unreachable.'} Organized it here instead.`,
        )
      }
    }

    setDrafts(organizeLocally(text))
    setBusy(false)
  }

  function addAll() {
    if (!drafts) return
    const created = drafts.map((d) => addTask(d.title, d.patch))
    pushToast(`Added ${created.length} task${created.length === 1 ? '' : 's'}`, () =>
      created.forEach((t) => removeTask(t.id)),
    )
    onClose()
  }

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => current?.map((d) => (d.id === id ? { ...d, ...patch } : d)) ?? null)

  return (
    <Sheet open onClose={onClose} title="Dump it, I'll sort it">
      {drafts === null ? (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={8}
            aria-label="Brain dump"
            autoCapitalize="sentences"
            spellCheck
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-[15px] leading-relaxed focus:border-accent/60"
          />
          <button
            type="button"
            onClick={organize}
            disabled={!text.trim() || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30"
          >
            <Icon name="sparkle" className="h-4 w-4" />
            {busy ? 'Sorting it out…' : 'Organize this'}
          </button>
          <p className="meta text-center text-faint">
            {loadApiKey() ? 'Using Claude' : 'Works offline. Add an API key in Settings for sharper results.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {note && (
            <p className="meta rounded-lg border border-line bg-surface-2 p-2.5 text-muted">{note}</p>
          )}

          {drafts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Couldn't find any tasks in that. Try again with a bit more detail.
            </p>
          ) : (
            <>
              <p className="label text-faint">
                {drafts.length} task{drafts.length === 1 ? '' : 's'} — fix anything it got wrong
              </p>
              <ul className="space-y-2">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onChange={(patch) => update(draft.id, patch)}
                    onDrop={() => setDrafts((c) => c?.filter((d) => d.id !== draft.id) ?? null)}
                  />
                ))}
              </ul>
            </>
          )}

          <div className="flex gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setDrafts(null)}
              className="rounded-lg border border-line px-3 py-2.5 text-sm text-muted"
            >
              Back
            </button>
            <button
              type="button"
              onClick={addAll}
              disabled={drafts.length === 0}
              className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-on-accent disabled:opacity-30"
            >
              Add {drafts.length === 1 ? 'it' : `all ${drafts.length}`}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function DraftCard({
  draft,
  onChange,
  onDrop,
}: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  onDrop: () => void
}) {
  const { tags } = useStore()
  const [showTags, setShowTags] = useState(false)
  const today = todayISO()
  const patch = draft.patch
  const current = patch.tags ?? []

  const setPatch = (next: Partial<Task>) => onChange({ patch: { ...patch, ...next } })

  const toggleTag = (id: string) =>
    setPatch({ tags: current.includes(id) ? current.filter((t) => t !== id) : [...current, id] })

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Task title"
          className="min-w-0 flex-1 border-b border-transparent text-[15px] leading-snug focus:border-accent/50"
        />
        <button
          type="button"
          onClick={onDrop}
          aria-label={`Drop ${draft.title}`}
          className="mt-0.5 shrink-0 text-faint hover:text-danger"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>

      <div className="meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        {current.length > 0 ? (
          current.map((t) => (
            <span key={t} style={{ color: tags.find((x) => x.id === t)?.color ?? 'inherit' }}>
              {t}
            </span>
          ))
        ) : (
          <span className="text-faint">untagged</span>
        )}
        {patch.dueDate && <span>due {formatDate(patch.dueDate, today)}</span>}
        {patch.targetDate && <span className="text-faint">want {formatDate(patch.targetDate, today)}</span>}
        {patch.estimateMinutes !== undefined && (
          <span className="text-faint">{formatDuration(patch.estimateMinutes)}</span>
        )}
        {patch.subtasks?.length ? <span className="text-faint">{patch.subtasks.length} steps</span> : null}
        {draft.uncertain && (
          <span className="text-accent" title="You hedged on this one — worth a check">
            unsure
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowTags((s) => !s)}
          className="ml-auto text-faint hover:text-ink"
          aria-expanded={showTags}
        >
          {showTags ? 'done' : 'change'}
        </button>
      </div>

      {showTags && (
        <div className="animate-rise mt-2.5 space-y-2.5 border-t border-line/70 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Pill key={tag.id} active={current.includes(tag.id)} color={tag.color} onClick={() => toggleTag(tag.id)}>
                {tag.label}
              </Pill>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="label space-y-1 text-faint">
              <span>hard deadline</span>
              <input
                type="date"
                value={patch.dueDate ?? ''}
                onChange={(e) => setPatch({ dueDate: e.target.value || undefined })}
                className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="label space-y-1 text-faint">
              <span>want it done by</span>
              <input
                type="date"
                value={patch.targetDate ?? ''}
                onChange={(e) => setPatch({ targetDate: e.target.value || undefined })}
                className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[10, 15, 30, 60, 120, 180].map((m) => (
              <Pill
                key={m}
                active={patch.estimateMinutes === m}
                onClick={() =>
                  setPatch({
                    estimateMinutes: patch.estimateMinutes === m ? undefined : m,
                    estimateConfidence: 'guess',
                  })
                }
              >
                {formatDuration(m, false)}
              </Pill>
            ))}
          </div>
          <p className="meta text-faint">heard: “{draft.source.trim()}”</p>
        </div>
      )}
    </li>
  )
}
