import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useFiltersStore } from '../store/filters'
import { getStoreName, getItemName } from '../core/mappings'

export function StoreItemSelector() {
  const { store, setStore, item, setItem, anchorDate, setAnchorDate, hierarchy, loading } = useFiltersStore(state => ({
    store: state.store,
    setStore: state.setStore,
    item: state.item,
    setItem: state.setItem,
    anchorDate: state.anchorDate,
    setAnchorDate: state.setAnchorDate,
    hierarchy: state.hierarchy,
    loading: state.hierarchyLoading
  }))

  const storeOptions = useMemo(() => hierarchy?.stores ?? [], [hierarchy])
  const itemOptions = useMemo(() => {
    if (!hierarchy || store === undefined) return []
    return hierarchy.items_by_store[String(store)] ?? []
  }, [hierarchy, store])

  return (
    <div className="bg-bg-surface border border-border-light rounded-xl p-3 flex flex-col gap-3 mt-4">
      <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider pl-1">AI Data Scope</div>
      
      <div className="flex flex-col gap-3">
        <select
          aria-label="Select Store"
          value={store ?? ''}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : undefined
            setStore(v)
            setItem(undefined)
          }}
          disabled={loading}
          className="w-full bg-bg-primary text-white text-sm border border-border-light rounded-lg px-3 py-2.5 cursor-pointer focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base transition-colors"
        >
          <option value="">{loading ? 'Loading...' : 'Select Store'}</option>
          {storeOptions.map((s) => (
            <option key={`store-${s}`} value={s}>{getStoreName(s)}</option>
          ))}
        </select>

        <select
          aria-label="Select Item"
          value={item ?? ''}
          onChange={(e) => setItem(e.target.value ? Number(e.target.value) : undefined)}
          disabled={!store || loading}
          className="w-full bg-bg-primary text-white text-sm border border-border-light rounded-lg px-3 py-2.5 cursor-pointer focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base disabled:opacity-50 transition-colors"
        >
          <option value="">{store ? 'Select Item' : 'Pick a store first'}</option>
          {itemOptions.map((i) => (
            <option key={`item-${i}`} value={i}>{getItemName(i)}</option>
          ))}
        </select>

        <div className="mt-1">
          <div className="text-[10px] text-fg-muted uppercase font-bold tracking-wider mb-1.5 pl-1">Simulation Date</div>
          <input
            type="date"
            value={anchorDate ?? '2026-05-15'}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="w-full bg-bg-primary text-white text-sm border border-border-light rounded-lg px-3 py-2.5 cursor-pointer focus:outline-none focus:border-accent-base focus:ring-1 focus:ring-accent-base"
          />
        </div>
      </div>
    </div>
  )
}

