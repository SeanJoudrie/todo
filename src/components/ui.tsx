import { useEffect } from 'react'
import type { ReactNode } from 'react'

export function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    check: <path d="M4 10.5 8 14.5 16 5.5" />,
    plus: (
      <>
        <path d="M10 4v12" />
        <path d="M4 10h12" />
      </>
    ),
    gear: (
      <>
        <circle cx="10" cy="10" r="2.6" />
        <path d="M10 2.4v2M10 15.6v2M2.4 10h2M15.6 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6 14 6M6 14l-1.4 1.4" />
      </>
    ),
    pin: <path d="M8 2.5h4l-.6 4.2 2.6 2.4H6l2.6-2.4z M10 9.1v8" />,
    flag: (
      <>
        <path d="M5 3v14" />
        <path d="M5 4h9l-1.8 3L14 10H5z" />
      </>
    ),
    clock: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4.3l2.6 1.6" />
      </>
    ),
    chevron: <path d="M7 4.5 12.5 10 7 15.5" />,
    x: (
      <>
        <path d="M5 5l10 10" />
        <path d="M15 5 5 15" />
      </>
    ),
    trash: (
      <>
        <path d="M3.5 5.5h13" />
        <path d="M8 5.5V3.8h4v1.7" />
        <path d="M5.2 5.5 6 16.2h8l.8-10.7" />
      </>
    ),
    compass: (
      <>
        <circle cx="10" cy="10" r="7.2" />
        <path d="m13 7-1.9 4.1L7 13l1.9-4.1z" />
      </>
    ),
    snooze: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M7.5 7.5h5l-5 5h5" />
      </>
    ),
    sparkle: (
      <>
        <path d="M8 2.5 9.3 6.2 13 7.5 9.3 8.8 8 12.5 6.7 8.8 3 7.5l3.7-1.3z" />
        <path d="M14.5 11.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
      </>
    ),
    undo: (
      <>
        <path d="M4 7h7.5a4 4 0 0 1 0 8H7" />
        <path d="M6.5 4 3.5 7l3 3" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function Pill({
  active,
  onClick,
  children,
  color,
  title,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  color?: string
  title?: string
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      style={color && active ? { backgroundColor: `${color}26`, borderColor: `${color}80`, color } : undefined}
      className={[
        'meta inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 whitespace-nowrap transition-colors',
        active
          ? 'border-accent/60 bg-accent/15 text-accent'
          : 'border-line bg-surface-2 text-muted hover:border-faint hover:text-ink',
        onClick ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Redundant with the Close button and Escape, so hidden from assistive tech
          rather than announcing a second "Close". */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-line bg-surface sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="label text-faint">{label}</div>
      {children}
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}
