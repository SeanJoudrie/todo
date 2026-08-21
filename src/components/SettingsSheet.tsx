import { useRef, useState } from 'react'
import {
  copyToClipboard,
  download,
  exportJSON,
  exportMarkdown,
  listSnapshots,
  loadApiKey,
  parseImport,
  saveApiKey,
  type SaveOutcome,
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
  const [paste, setPaste] = useState('')
  const [showPaste, setShowPaste] = useState(false)

  const snapshots = listSnapshots()
  const stamp = new Date().toISOString().slice(0, 10)
  const seedCount = tasks.filter((t) => t.seed).length

  function report(outcome: SaveOutcome, what: string) {
    if (outcome === 'saved') pushToast(`${what} saved`)
    else if (outcome === 'declined') pushToast('Save cancelled')
    else pushToast(`Couldn't save — use "copy" instead`)
  }

  function restore(text: string) {
    setError(null)
    const result = parseImport(text)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const previous = fullState
    replaceAll(result.state)
    setPaste('')
    setShowPaste(false)
    pushToast(`Restored ${result.state.tasks.length} tasks`, () => replaceAll(previous))
  }

  async function onFile(file: File) {
    restore(await file.text())
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
            <Pill
              onClick={async () =>
                report(await download(`todo-${stamp}.json`, exportJSON(fullState), 'application/json'), 'Backup')
              }
            >
              export JSON
            </Pill>
            <Pill
              onClick={async () =>
                report(await download(`todo-${stamp}.md`, exportMarkdown(tasks), 'text/markdown'), 'Checklist')
              }
            >
              export markdown
            </Pill>
            <Pill
              onClick={async () =>
                pushToast(
                  (await copyToClipboard(exportJSON(fullState)))
                    ? 'Backup copied — paste it somewhere safe'
                    : "Couldn't reach the clipboard",
                )
              }
            >
              copy backup
            </Pill>
            <Pill onClick={() => fileRef.current?.click()}>import file</Pill>
            <Pill onClick={() => setShowPaste((v) => !v)}>paste a backup</Pill>
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
          {showPaste && (
            <div className="animate-rise space-y-2">
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="Paste the contents of a backup here"
                rows={4}
                aria-label="Paste a backup"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[11px]"
              />
              <Pill onClick={() => restore(paste)}>restore from this</Pill>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <p className="text-[11px] text-faint">
            Everything lives in this browser only, per link — a task added here won't show up on a different
            copy of the app. Back it up sometimes; it's the only copy.
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
