import { useMemo } from 'react'
import { formatDuration } from '../lib/dates'
import { heroTask } from '../lib/planner'
import { useStore } from '../hooks'
import { Icon } from './ui'

export function HeroCard({ onOpenPlanner }: { onOpenPlanner: () => void }) {
  const { tasks, setDone, snooze, pushToast } = useStore()
  const hero = useMemo(() => heroTask(tasks), [tasks])

  if (!hero) return null

  return (
    <div className="mx-3 mt-3 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-b from-accent/12 to-transparent">
      <div className="p-4">
        <div className="text-[11px] tracking-wide text-accent uppercase">Right now, just do this</div>
        <div className="mt-1.5 text-lg leading-snug font-medium">{hero.task.title}</div>
        <div className="mt-1 text-xs text-muted">
          {hero.reason}
          <span className="text-faint">
            {' · '}
            {hero.partial ? `give it ${formatDuration(hero.minutes, false)}` : formatDuration(hero.minutes)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDone(hero.task.id, true)
              pushToast('Done', () => setDone(hero.task.id, false))
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent active:scale-[0.98]"
          >
            <Icon name="check" className="h-4 w-4" /> Done
          </button>
          <button
            type="button"
            onClick={() => {
              snooze(hero.task.id, new Date(Date.now() + 3 * 3600_000))
              pushToast('Pushed a few hours out')
            }}
            className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onOpenPlanner}
            className="ml-auto inline-flex items-center gap-1 text-xs text-faint hover:text-ink"
          >
            plan the day <Icon name="chevron" className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
