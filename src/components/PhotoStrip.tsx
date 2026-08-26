import { useEffect, useRef, useState } from 'react'
import type { Task } from '../types'
import { deletePhoto, getPhoto, savePhoto } from '../lib/photos'
import { useStore } from '../hooks'
import { Icon } from './ui'

/** Object URLs have to be revoked or the tab leaks a few MB per photo viewed. */
function usePhotoUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null

    getPhoto(id).then((record) => {
      if (!record || revoked) return
      objectUrl = URL.createObjectURL(record.blob)
      setUrl(objectUrl)
    })

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return url
}

function Thumb({ id, onOpen, onRemove }: { id: string; onOpen: () => void; onRemove: () => void }) {
  const url = usePhotoUrl(id)

  return (
    <div className="group relative h-20 w-20 shrink-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label="View photo"
        className="h-full w-full overflow-hidden rounded-lg border border-line bg-surface-2"
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="meta flex h-full items-center justify-center text-faint">…</span>
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-faint shadow-sm hover:border-danger/60 hover:text-danger"
      >
        <Icon name="x" className="h-3 w-3" />
      </button>
    </div>
  )
}

function Lightbox({ id, onClose }: { id: string; onClose: () => void }) {
  const url = usePhotoUrl(id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
      <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0" onClick={onClose} />
      {url && <img src={url} alt="" className="relative max-h-full max-w-full rounded-lg object-contain" />}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-4 right-4 rounded-full bg-surface/90 p-2 text-ink"
      >
        <Icon name="x" />
      </button>
    </div>
  )
}

export function PhotoStrip({ task }: { task: Task }) {
  const { attachPhoto, detachPhoto, pushToast } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const photos = task.photos ?? []

  async function add(files: FileList) {
    setBusy(true)
    setError(null)
    let added = 0

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const meta = await savePhoto(file)
        attachPhoto(task.id, meta.id)
        added++
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That photo would not save.')
      }
    }

    setBusy(false)
    if (added > 0) pushToast(`${added} photo${added === 1 ? '' : 's'} added`)
  }

  async function remove(photoId: string) {
    detachPhoto(task.id, photoId)
    await deletePhoto(photoId)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {photos.map((id) => (
          <Thumb key={id} id={id} onOpen={() => setViewing(id)} onRemove={() => void remove(id)} />
        ))}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-faint hover:border-accent/60 hover:text-accent disabled:opacity-40"
        >
          <Icon name="camera" className="h-5 w-5" />
          <span className="meta">{busy ? 'saving…' : photos.length > 0 ? 'add' : 'photo'}</span>
        </button>
      </div>

      {/* No `capture` attribute: that would force the camera and hide the library. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void add(e.target.files)
          e.target.value = ''
        }}
      />

      {error && <p className="meta text-danger">{error}</p>}

      {viewing && <Lightbox id={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
