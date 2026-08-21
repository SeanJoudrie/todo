import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { parseCapture, splitCapture, undoChip } from '../lib/parse'
import { useStore } from '../hooks'
import { Icon } from './ui'

export function CaptureBar({ inputRef }: { inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const { addTask, addMany, removeTask, pushToast } = useStore()
  const [text, setText] = useState('')
  const [dismissed, setDismissed] = useState<string[]>([])
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? localRef

  const lines = useMemo(() => splitCapture(text), [text])
  const isDump = lines.length > 1

  // Parse only a single line — a brain dump is parsed per line at submit time.
  const parsed = useMemo(() => {
    if (isDump || text.trim().length === 0) return null
    let result = parseCapture(text)
    for (const id of dismissed) result = undoChip(result, id)
    return result
  }, [text, isDump, dismissed])

  // Grow with dictated text instead of hiding it behind a scrollbar.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text, ref])

  function submit() {
    if (lines.length === 0) return

    if (isDump) {
      const created = addMany(lines)
      pushToast(`Added ${created.length} tasks`, () => created.forEach((t) => removeTask(t.id)))
    } else if (parsed) {
      const task = addTask(parsed.title, parsed.patch)
      pushToast('Added', () => removeTask(task.id))
    }

    setText('')
    setDismissed([])
    ref.current?.focus()
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
          }}
          onKeyDown={(e) => {
            // Enter sends on a hardware keyboard; the button is the path on a phone.
            if (e.key === 'Enter' && !e.shiftKey && !isDump) {
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
          disabled={lines.length === 0}
          aria-label={isDump ? `Add ${lines.length} tasks` : 'Add task'}
          className="mb-px flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent transition-opacity disabled:opacity-25"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>

      {isDump && (
        <p className="mt-2 px-1 text-xs text-muted">
          Brain dump — this will make <span className="text-accent">{lines.length} separate tasks</span>.
        </p>
      )}

      {parsed && parsed.chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-faint">picked up:</span>
          {parsed.chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setDismissed((d) => [...d, chip.id])}
              title="Tap to undo this"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:border-danger/60 hover:bg-danger/10 hover:text-danger ${
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
