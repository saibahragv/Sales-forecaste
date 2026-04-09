import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'

type HierarchyResponse = {
  stores: number[]
  items_by_store: Record<string, number[]>
  min_date: string
  max_date: string
}

export function HierarchicalIntelligencePage() {
  const { store, setStore, setItem } = useFiltersStore()
  const [hier, setHier] = useState<HierarchyResponse | null>(null)
  
  useEffect(() => {
    api.get<HierarchyResponse>('/hierarchy').then((r) => setHier(r.data))
  }, [])

  const storeOptions = useMemo(() => hier?.stores ?? [], [hier])
  const itemOptions = useMemo(() => {
    if (!hier || store === undefined) return []
    return hier.items_by_store[String(store)] ?? []
  }, [hier, store])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-bold glow-text mb-1">3D Topology Explorer</h2>
           <p className="text-sm text-foreground-muted">Navigate your business hierarchy in a pseudo-3D space.</p>
        </div>
      </div>

      <div className="hierarchy-3d-wrap glass-panel flex justify-center items-center overflow-hidden h-[600px] relative mt-4 cursor-crosshair">
        
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(var(--border-light) 1px, transparent 1px), linear-gradient(90deg, var(--border-light) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Central Hub */}
        <motion.div 
           className="hierarchy-node z-10 w-32 h-32 rounded-full bg-accent-base flex items-center justify-center text-white font-bold shadow-[0_0_40px_var(--accent-glow)]"
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           transition={{ type: 'spring', damping: 15 }}
        >
          GLOBAL
        </motion.div>

        {/* Orbiting Stores */}
        {storeOptions.slice(0, 8).map((s, idx) => {
          const angle = (idx / Math.min(storeOptions.length, 8)) * Math.PI * 2;
          const radius = 180;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isSelected = store === s;

          return (
             <motion.div 
               key={`store-${s}`}
               className={`hierarchy-node absolute w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-300 ${isSelected ? 'bg-white text-black shadow-[0_0_20px_#fff]' : 'bg-bg-surface border border-border-light text-white hover:bg-accent-hover hover:text-black'}`}
               initial={{ opacity: 0, x: 0, y: 0 }}
               animate={{ opacity: 1, x, y }}
               transition={{ delay: idx * 0.1, type: 'spring' }}
               onClick={() => setStore(s)}
             >
               S{s}
             </motion.div>
          );
        })}

        {/* Selected Store Items (Dynamic Spawn) */}
        <AnimatePresence>
          {store !== undefined && itemOptions.slice(0, 10).map((it, idx) => {
            // Find parent store pos
            const sIdx = storeOptions.findIndex(s => s === store);
            if (sIdx === -1 || sIdx > 7) return null;
            const sAngle = (sIdx / Math.min(storeOptions.length, 8)) * Math.PI * 2;
            const sRadius = 180;
            const sx = Math.cos(sAngle) * sRadius;
            const sy = Math.sin(sAngle) * sRadius;

            // Spawn items around the store
            const subAngle = (idx / Math.min(itemOptions.length, 10)) * Math.PI * 2;
            const subRadius = 80;
            const x = sx + Math.cos(subAngle) * subRadius;
            const y = sy + Math.sin(subAngle) * subRadius;

            return (
               <motion.div 
                 key={`item-${it}`}
                 className="hierarchy-node absolute w-10 h-10 rounded-lg bg-bg-secondary border border-border-glow flex items-center justify-center text-xs cursor-pointer hover:scale-110 hover:bg-white hover:text-black text-fg-muted"
                 initial={{ opacity: 0, x: sx, y: sy, scale: 0 }}
                 animate={{ opacity: 1, x, y, scale: 1 }}
                 exit={{ opacity: 0, scale: 0, x: sx, y: sy }}
                 transition={{ delay: idx * 0.05, type: 'spring' }}
                 onClick={() => setItem(it)}
               >
                 I{it}
               </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  )
}
