import { useContext, useMemo } from 'react'
import { StoreContext, type Store } from './store-context'

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

export function useTagColors(): Record<string, string> {
  const { tags } = useStore()
  return useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t.color])), [tags])
}
