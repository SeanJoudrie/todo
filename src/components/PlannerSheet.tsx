import { useMemo, useState } from 'react'
import type { Energy } from '../types'
import { addDays, formatDuration, todayISO } from '../lib/dates'
import { buildPlan, slotLabel, type PlanItem } from '../lib/planner'
import { useStore } from '../hooks'
import { Icon, Pill, Sheet } from './ui'

const BUDGETS = [
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 240, label: 'half day' },
  { minutes: 480, label: 'full day' },
]

const ENERGIES: { value: Energy; label: string }[] = [
  { value: 'fried', label: 'fried' },
  { value: 'normal', label: 'normal' },
  { value: 'sharp', label: 'sharp' },
]

export function PlannerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore()
  const { tasks, tags, settings, setSettings, setDone, snooze, pushToast } = store

  const [budget, setBudget] = useState(settings.lastBudget)
  const [energy, setEnergy] = useState<Energy>(settings.lastEnergy)
  const [focusTags, setFocusTags] = useState<string[]>(settings.lastFocusTags)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [explain, setExplain] = useState(false)
  // Frozen so the clock in the plan doesn't crawl forward while you read it.
  const [now] = useState(() => new Date())

  const plan = useMemo(
    () =>
      buildPlan(
        tasks.filter((t) => !dismissed.includes(t.id)),
        { budgetMinutes: budget, energy, focusTags, now },
      ),
    [tasks, dismissed, budget, energy, focusTags, now],
  )

  const remember = (patch: Partial<typeof settings>) => setSettings(patch)

  const usedTags = useMemo(() => {
    const counts = new Set(tasks.filter((t) => t.status === 'open').flatMap((t) => t.tags))
    return tags.filter((t) => counts.has(t.id))
  }, [tasks, tags])

  return (
    <Sheet open={open} onClose={onClose} title="What should I do today?">
      <div className="space-y-4">
        {/* Controls */}
        <div className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-faint uppercase">time</span>
            {BUDGETS.map((b) => (
              <Pill
                key={b.minutes}
                active={budget === b.minutes}
                onClick={() => {
                  setBudget(b.minutes)
                  remember({ lastBudget: b.minutes })
                }}
              >
                {b.label}
              </Pill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-faint uppercase">energy</span>
            {ENERGIES.map((e) => (
              <Pill
                key={e.value}
                active={energy === e.value}
                onClick={() => {
                  setEnergy(e.value)
                  remember({ lastEnergy: e.value })
                }}
              >
                {e.label}
              </Pill>
            ))}
          </div>

          {usedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-faint uppercase">focus</span>
              <Pill
                active={focusTags.length === 0}
                onClick={() => {
                  setFocusTags([])
                  remember({ lastFocusTags: [] })
                }}
              >
                whatever
              </Pill>
              {usedTags.map((tag) => (
                <Pill
                  key={tag.id}
                  active={focusTags.includes(tag.id)}
                  color={tag.color}
                  onClick={() => {
                    const next = focusTags.includes(tag.id)
                      ? focusTags.filter((t) => t !== tag.id)
                      : [...focusTags, tag.id]
                    setFocusTags(next)
                    remember({ lastFocusTags: next })
                  }}
                >
                  {tag.label}
                </Pill>
              ))}
            </div>
          )}
        </div>

        {/* The plan */}
        {plan.items.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Nothing fits {formatDuration(budget, false)}
            {focusTags.length > 0 && ' with that focus'}. Try more time, or drop the focus.
          </p>
        ) : (
          <ol className="space-y-2">
            {plan.items.map((item, i) => (
              <PlanRow
                key={item.task.id}
                item={item}
                index={i}
                slot={slotLabel(plan, item)}
                explain={explain}
                onDone={() => {
                  setDone(item.task.id, true)
                  pushToast(`Done — ${formatDuration(item.minutes, false)} back`, () => setDone(item.task.id, false))
                }}
                onNotToday={() => {
                  snooze(item.task.id, new Date(`${addDays(todayISO(now), 1)}T04:00`))
                  setDismissed((d) => [...d, item.task.id])
                }}
                onSwap={() => setDismissed((d) => [...d, item.task.id])}
              />
            ))}
          </ol>
        )}

        {/* Summary */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
          <span>
            {formatDuration(plan.usedMinutes, false)} of {formatDuration(budget, false)} planned
          </span>
          <span className="text-line">|</span>
          <button type="button" onClick={() => setBudget((b) => b + 30)} className="text-accent hover:underline">
            + 30m, I have more time
          </button>
          <button
            type="button"
            onClick={() => setExplain((e) => !e)}
            className="ml-auto text-faint hover:text-ink hover:underline"
          >
            {explain ? 'hide' : 'explain'} scoring
          </button>
        </div>

        {plan.spillover.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] tracking-wide text-faint uppercase">If you get more time</div>
            <ul className="space-y-0.5">
              {plan.spillover.map((t) => (
                <li key={t.id} className="text-sm text-muted">
                  {t.title}
                  {t.estimateMinutes !== undefined && (
                    <span className="text-faint"> · {formatDuration(t.estimateMinutes)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan.excluded.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] tracking-wide text-faint uppercase">Not planned</div>
            <ul className="space-y-0.5">
              {plan.excluded.map(({ task, why }) => (
                <li key={task.id} className="text-sm text-faint">
                  {task.title} — {why}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dismissed.length > 0 && (
          <button
            type="button"
            onClick={() => setDismissed([])}
            className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink"
          >
            <Icon name="undo" className="h-3 w-3" /> put back the {dismissed.length} I skipped
          </button>
        )}
      </div>
    </Sheet>
  )
}

function PlanRow({
  item,
  index,
  slot,
  explain,
  onDone,
  onNotToday,
  onSwap,
}: {
  item: PlanItem
  index: number
  slot: string
  explain: boolean
  onDone: () => void
  onNotToday: () => void
  onSwap: () => void
}) {
  const b = item.breakdown
  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onDone}
          aria-label={`Complete ${item.task.title}`}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-faint hover:border-done active:scale-95"
        >
          <Icon name="check" className="h-3 w-3 opacity-0 hover:opacity-100" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] text-accent tabular-nums">{slot}</span>
            {item.estimateUnknown && (
              <span className="text-[10px] text-faint" title="No estimate — assumed 45m">
                ~?
              </span>
            )}
          </div>
          <div className="text-[15px] leading-snug">
            {index + 1}. {item.task.title}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">{item.reasons.join(' · ')}</div>

          {explain && (
            <div className="mt-1.5 font-mono text-[10px] text-faint">
              urgency {b.urgency} · importance {b.importance} · fit {b.fit} · momentum {b.momentum} · seq{' '}
              {b.sequencing} · stale {b.staleness} · friction {b.friction === 0 ? 0 : `−${b.friction}`} · energy{' '}
              {b.energy} = <span className="text-muted">{b.total}</span>
            </div>
          )}

          <div className="mt-2 flex gap-3 text-[11px]">
            <button type="button" onClick={onNotToday} className="text-faint hover:text-ink">
              not today
            </button>
            <button type="button" onClick={onSwap} className="text-faint hover:text-ink">
              swap this
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
