import { useRef, useState } from 'react'
import {
  download,
  exportJSON,
  exportMarkdown,
  listSnapshots,
  loadApiKey,
  parseImport,
  saveApiKey,
} from '../lib/storage'
import { useStore } from '../hooks'
import { TagManager } from './TagManager'
import { Field, Pill, Sheet } from './ui'

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore()
  const { tasks, fullState, replaceAll, clearSeed, resetEverything, pushToast, storageOk } = store
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [apiKey, setApiKey] = useState(() => loadApiKey())

  const snapshots = listSnapshots()
  const stamp = new Date().toISOString().slice(0, 10)
  const seedCount = tasks.filter((t) => t.seed).length

  async function onFile(file: File) {
    setError(null)
    const result = parseImport(await file.text())
    if (!result.ok) {
      setError(result.error)
      return
    }
    const previous = fullState
    replaceAll(result.state)
    pushToast(`Imported ${result.state.tasks.length} tasks`, () => replaceAll(previous))
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-5">
        {!storageOk && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            This browser is refusing to save. Nothing you add will survive a refresh — export a backup now.
          </p>
        )}

        <Field label="Smarter organizing (optional)">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              saveApiKey(e.target.value)
            }}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Anthropic API key"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
          />
          <p className="text-[11px] leading-relaxed text-faint">
            Paste an Anthropic API key and "Dump it" uses Claude to sort your brain-dumps instead of the built-in
            parser. Without one it still works, just more literally. The key stays in this browser, goes straight to
            Anthropic, and is deliberately left out of your JSON backups.
          </p>
        </Field>

        <Field label="Tags">
          <TagManager />
        </Field>

        <Field label="Backup">
          <div className="flex flex-wrap gap-1.5">
            <Pill onClick={() => download(`todo-${stamp}.json`, exportJSON(fullState), 'application/json')}>
              export JSON
            </Pill>
            <Pill onClick={() => download(`todo-${stamp}.md`, exportMarkdown(tasks), 'text/markdown')}>
              export markdown
            </Pill>
            <Pill onClick={() => fileRef.current?.click()}>import JSON</Pill>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <p className="text-[11px] text-faint">
            Everything lives in this browser only. Export sometimes — it's the only copy.
          </p>
        </Field>

        {snapshots.length > 0 && (
          <Field label={`Auto-saves (${snapshots.length})`}>
            <ul className="space-y-1">
              {snapshots.slice(0, 5).map((snap) => (
                <li key={snap.at} className="flex items-center gap-2 text-xs text-muted">
                  <span className="tabular-nums">{new Date(snap.at).toLocaleString()}</span>
                  <span className="text-faint">{snap.taskCount} tasks</span>
                  <button
                    type="button"
                    onClick={() => {
                      const previous = fullState
                      replaceAll(snap.state)
                      pushToast('Restored', () => replaceAll(previous))
                    }}
                    className="ml-auto text-accent hover:underline"
                  >
                    restore
                  </button>
                </li>
              ))}
            </ul>
          </Field>
        )}

        {seedCount > 0 && (
          <Field label="Sample data">
            <Pill
              onClick={() => {
                clearSeed()
                pushToast(`Cleared ${seedCount} sample tasks`)
              }}
            >
              clear the {seedCount} tasks it shipped with
            </Pill>
          </Field>
        )}

        <Field label="Danger">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-danger">Delete all {tasks.length} tasks? No undo.</span>
              <button
                type="button"
                onClick={() => {
                  resetEverything()
                  setConfirmReset(false)
                  onClose()
                }}
                className="rounded-full border border-danger/60 bg-danger/10 px-2.5 py-1 text-xs text-danger"
              >
                yes, wipe it
              </button>
              <Pill onClick={() => setConfirmReset(false)}>cancel</Pill>
            </div>
          ) : (
            <Pill onClick={() => setConfirmReset(true)}>delete everything</Pill>
          )}
        </Field>

        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
          Deadlines in red are hard. "Want" dates are the soft ones the planner actually works toward. Durations are
          always guesses — that's fine, the planner assumes ~45m when you don't say.
        </p>
      </div>
    </Sheet>
  )
}
