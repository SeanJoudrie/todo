import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { organizeLocally } from '../lib/organize'
import { parseCapture, undoChip } from '../lib/parse'
import { useStore } from '../hooks'
import { Icon } from './ui'

export function CaptureBar({ inputRef }: { inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const { addTask, removeTask, pushToast } = useStore()
  const [text, setText] = useState('')
  const [dismissed, setDismissed] = useState<string[]>([])
  const [keepAsOne, setKeepAsOne] = useState(false)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? localRef

  /**
   * One pass over whatever was said. "clean my room then call my dad then pay
   * the Xfinity bill" is three jobs, and this is where that gets noticed.
   */
  const drafts = useMemo(() => (text.trim() ? organizeLocally(text) : []), [text])
  const isMulti = drafts.length > 1 && !keepAsOne

  // A single item keeps the original inline-chip treatment — it's the fast path.
  const parsed = useMemo(() => {
    if (isMulti || text.trim().length === 0) return null
    let result = parseCapture(text)
    for (const id of dismissed) result = undoChip(result, id)
    return result
  }, [text, isMulti, dismissed])

  // Grow with dictated text instead of hiding it behind a scrollbar.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text, ref])

  function reset() {
    setText('')
    setDismissed([])
    setKeepAsOne(false)
    ref.current?.focus()
  }

  function submit() {
    if (!text.trim()) return

    if (isMulti) {
      const created = drafts.map((d) => addTask(d.title, d.patch))
      pushToast(`Added ${created.length} tasks`, () => created.forEach((t) => removeTask(t.id)))
    } else if (parsed) {
      const task = addTask(parsed.title, parsed.patch)
      pushToast('Added', () => removeTask(task.id))
    }

    reset()
  }

  return (
    <div className="border-b border-line bg-bg/95 px-3 py-2.5 backdrop-blur">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDismissed([])
            setKeepAsOne(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="What's on your mind? Talk or type…"
          aria-label="Capture a task"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] leading-snug focus:border-accent/50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          aria-label={isMulti ? `Add ${drafts.length} tasks` : 'Add task'}
          className="mb-px flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent transition-opacity disabled:opacity-25"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>

      {isMulti && (
        <div className="animate-rise mt-2 rounded-lg border border-accent/30 bg-accent-wash px-3 py-2">
          <div className="label mb-1.5 flex items-center gap-2 text-accent">
            <span>heard {drafts.length} things</span>
            <button
              type="button"
              onClick={() => setKeepAsOne(true)}
              className="ml-auto normal-case text-faint hover:text-ink"
            >
              keep as one
            </button>
          </div>
          <ol className="space-y-0.5">
            {drafts.map((d, i) => (
              <li key={d.id} className="meta text-muted">
                <span className="text-faint">{i + 1}.</span> {d.title}
                {d.patch.tags?.length ? <span className="text-faint"> · {d.patch.tags.join(' ')}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}

      {keepAsOne && drafts.length > 1 && (
        <button
          type="button"
          onClick={() => setKeepAsOne(false)}
          className="meta mt-2 text-faint hover:text-ink"
        >
          actually, split it into {drafts.length}
        </button>
      )}

      {parsed && parsed.chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="meta text-faint">picked up:</span>
          {parsed.chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setDismissed((d) => [...d, chip.id])}
              title="Tap to undo this"
              className={`meta inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:border-danger/60 hover:bg-danger/10 hover:text-danger ${
                chip.kind === 'context' || chip.kind === 'effort'
                  ? 'border-line bg-surface-2 text-faint'
                  : 'border-accent/40 bg-accent/10 text-accent'
              }`}
            >
              {chip.label}
              <Icon name="x" className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
