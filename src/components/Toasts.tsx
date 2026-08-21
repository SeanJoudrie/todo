import { useStore } from '../hooks'
import { Icon } from './ui'

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="animate-rise pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface-3 py-2 pr-2 pl-4 text-sm shadow-lg shadow-black/10"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                dismissToast(toast.id)
              }}
              className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-accent"
            >
              <Icon name="undo" className="h-3 w-3" /> undo
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-faint hover:text-ink"
          >
            <Icon name="x" className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
