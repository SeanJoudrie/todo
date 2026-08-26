/**
 * Photo storage.
 *
 * Tasks stay in localStorage — they're small and a synchronous store keeps the
 * app simple. Photos do not: one phone photo is several MB and would blow the
 * whole ~5 MB budget on its own. So images live in IndexedDB, keyed by id, and
 * a task only ever holds the ids.
 *
 * Everything here is best-effort. A private window, a full disk, or a browser
 * that refuses IndexedDB must degrade to "no photos", never to a broken app.
 */

const DB_NAME = 'todo-photos'
const DB_VERSION = 1
const STORE = 'photos'

/** Long edge, in pixels. Plenty to read a document or see a cracked windshield. */
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export type PhotoRecord = {
  id: string
  blob: Blob
  width: number
  height: number
  addedAt: string
}

export type PhotoMeta = Omit<PhotoRecord, 'blob'> & { size: number }

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const request = run(db.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

/* -------------------------------------------------------------------------- */
/* Shrinking                                                                  */
/* -------------------------------------------------------------------------- */

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  // `from-image` applies EXIF orientation, so phone photos aren't sideways.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image.'))
      el.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Scale down to something a phone can hold hundreds of. */
export async function shrink(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const { source, width, height } = await decode(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  ctx.drawImage(source, 0, 0, w, h)
  if (source instanceof ImageBitmap) source.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Could not process that image.')
  return { blob, width: w, height: h }
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

let counter = 0
const photoId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function savePhoto(file: Blob): Promise<PhotoMeta> {
  const { blob, width, height } = await shrink(file)
  const record: PhotoRecord = { id: photoId(), blob, width, height, addedAt: new Date().toISOString() }
  const stored = await tx('readwrite', (store) => store.put(record) as IDBRequest<IDBValidKey>)
  if (stored === null) throw new Error("This browser won't store photos.")
  return { id: record.id, width, height, addedAt: record.addedAt, size: blob.size }
}

export async function getPhoto(id: string): Promise<PhotoRecord | null> {
  return (await tx('readonly', (store) => store.get(id) as IDBRequest<PhotoRecord>)) ?? null
}

export async function deletePhoto(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
}

export async function allPhotoIds(): Promise<string[]> {
  const keys = await tx('readonly', (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>)
  return (keys ?? []).map(String)
}

/** Drop images no task points at any more. Safe to call whenever. */
export async function pruneOrphans(usedIds: Set<string>): Promise<number> {
  const stored = await allPhotoIds()
  const orphans = stored.filter((id) => !usedIds.has(id))
  for (const id of orphans) await deletePhoto(id)
  return orphans.length
}

/* -------------------------------------------------------------------------- */
/* Backup                                                                     */
/* -------------------------------------------------------------------------- */

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read a stored photo.'))
    reader.readAsDataURL(blob)
  })

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

export async function exportPhotos(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of ids) {
    const record = await getPhoto(id)
    if (record) out[id] = await blobToDataUrl(record.blob)
  }
  return out
}

export async function importPhotos(photos: Record<string, string>): Promise<number> {
  let restored = 0
  for (const [id, dataUrl] of Object.entries(photos ?? {})) {
    try {
      const blob = await dataUrlToBlob(dataUrl)
      const record: PhotoRecord = { id, blob, width: 0, height: 0, addedAt: new Date().toISOString() }
      if ((await tx('readwrite', (store) => store.put(record) as IDBRequest<IDBValidKey>)) !== null) restored++
    } catch {
      /* one bad image must not abort the whole restore */
    }
  }
  return restored
}

/** Roughly how much room the photos are taking, when the browser will say. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate?.usage || !estimate.quota) return null
    return { usedMb: estimate.usage / 1_048_576, quotaMb: estimate.quota / 1_048_576 }
  } catch {
    return null
  }
}
