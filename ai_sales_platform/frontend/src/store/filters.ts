import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../core/api'

export type HierarchyResponse = {
  stores: number[]
  items_by_store: Record<string, number[]>
  min_date: string
  max_date: string
}

let hierarchyInFlight: Promise<HierarchyResponse> | null = null

export type FiltersState = {
  store?: number
  item?: number
  horizonDays: number
  anchorDate?: string
  aggregation: 'daily' | 'weekly' | 'monthly'
  normalize: boolean
  showConfidence: boolean
  compareStores: number[]
  compareItems: number[]
  drilldown: 'store_item' | 'store' | 'item'
  
  workspaceRole: 'executive' | 'analyst' | 'operations'

  hierarchy: HierarchyResponse | null
  hierarchyLoading: boolean
  hierarchyError: string | null
  loadHierarchy: (opts?: { force?: boolean }) => Promise<HierarchyResponse>
  clearHierarchy: () => void

  setStore: (store?: number) => void
  setItem: (item?: number) => void
  setHorizonDays: (days: number) => void
  setAnchorDate: (anchorDate?: string) => void
  setAggregation: (aggregation: 'daily' | 'weekly' | 'monthly') => void
  setNormalize: (normalize: boolean) => void
  setShowConfidence: (showConfidence: boolean) => void
  setCompareStores: (stores: number[]) => void
  setCompareItems: (items: number[]) => void
  setDrilldown: (drilldown: 'store_item' | 'store' | 'item') => void
  setWorkspaceRole: (role: 'executive' | 'analyst' | 'operations') => void
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set, get) => ({
      store: undefined,
      item: undefined,
      horizonDays: 30,
      anchorDate: undefined,
      aggregation: 'daily',
      normalize: false,
      showConfidence: false,
      compareStores: [],
      compareItems: [],
      drilldown: 'store_item',
      workspaceRole: 'executive',

      hierarchy: null,
      hierarchyLoading: false,
      hierarchyError: null,
      loadHierarchy: async (opts): Promise<HierarchyResponse> => {
        const force = Boolean(opts?.force)
        const st = get()
        if (!force && st.hierarchy) return st.hierarchy
        if (!force && hierarchyInFlight) return hierarchyInFlight

        set({ hierarchyLoading: true, hierarchyError: null })

        hierarchyInFlight = api
          .get<HierarchyResponse>('/hierarchy')
          .then((r) => {
            const data = r.data
            set({ hierarchy: data, hierarchyLoading: false, hierarchyError: null })

            const cur = get()
            if (data.stores.length && cur.store === undefined) set({ store: data.stores[0] })
            if (!cur.anchorDate || cur.anchorDate.startsWith('2017') || cur.anchorDate.startsWith('2013')) {
              set({ anchorDate: '2026-05-15' })
            }

            return data
          })
          .catch((e) => {
            const msg = e?.response?.data?.detail ?? e?.message ?? 'Failed to load hierarchy'
            set({ hierarchyLoading: false, hierarchyError: msg })
            throw e
          })
          .finally(() => {
            hierarchyInFlight = null
          })

        return hierarchyInFlight as Promise<HierarchyResponse>
      },
      clearHierarchy: () => set({ hierarchy: null, hierarchyError: null, hierarchyLoading: false }),

      setStore: (store) => set({ store }),
      setItem: (item) => set({ item }),
      setHorizonDays: (horizonDays) => set({ horizonDays }),
      setAnchorDate: (anchorDate) => set({ anchorDate }),
      setAggregation: (aggregation) => set({ aggregation }),
      setNormalize: (normalize) => set({ normalize }),
      setShowConfidence: (showConfidence) => set({ showConfidence }),
      setCompareStores: (compareStores) => set({ compareStores }),
      setCompareItems: (compareItems) => set({ compareItems }),
      setDrilldown: (drilldown) => set({ drilldown }),
      setWorkspaceRole: (workspaceRole) => set({ workspaceRole }),
    }),
    {
      name: 'ai-sales-platform-storage', // unique name
      partialize: (state) => ({ 
        workspaceRole: state.workspaceRole,
        store: state.store,
        item: state.item,
        horizonDays: state.horizonDays,
        aggregation: state.aggregation,
        showConfidence: state.showConfidence
      }), // only persist these fields
    }
  )
)
