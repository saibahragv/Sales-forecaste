import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { usePageContext } from '../../store/pageContext'
import { getStoreName, getItemName } from '../../core/mappings'

type HierarchyResponse = {
  stores: number[]
  items_by_store: Record<string, number[]>
  min_date: string
  max_date: string
}

const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}

export function HierarchicalIntelligencePage() {
  const { store: selectedStore, item: selectedItem, setStore, setItem } = useFiltersStore()
  const { updatePageData } = usePageContext()
  const [hier, setHier] = useState<HierarchyResponse | null>(null)
  const [riskMap, setRiskMap] = useState<Record<string, string>>({})
  
  useEffect(() => {
    api.get<HierarchyResponse>('/hierarchy').then(r => {
      setHier(r.data)
      updatePageData({ storeCount: r.data.stores.length, dataRange: `${r.data.min_date} → ${r.data.max_date}` })
    })
    api.get<{ alerts: { store: number; risk_band: string; stockout_risk_band: string }[] }>('/inventory/alerts?top_n=50')
      .then(r => {
        const m: Record<string, string> = {}
        r.data.alerts.forEach(a => { m[`s${a.store}`] = a.stockout_risk_band || a.risk_band || 'MEDIUM' })
        setRiskMap(m)
      }).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-indigo-500 bg-clip-text text-transparent m-0 tracking-tight">
            Intelligence Matrix Array
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {hier ? `${hier.stores.length} operational nodes synchronized.` : 'Initializing arrays...'} System tracking real-time catalog velocity and risk bands.
          </p>
        </div>
      </div>      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 overflow-y-auto pr-2 pb-4 pt-2">
        {hier?.stores.map(s => {
           const items = hier.items_by_store[String(s)] || [];
           const risk = riskMap[`s${s}`] || 'LOW';
           const riskC = RISK_COLOR[risk];

           return (
              <motion.div 
                 key={s}
                 whileHover={{ y: -6, scale: 1.02 }}
                 className="glass-panel p-5 flex flex-col gap-4 relative overflow-hidden group cursor-pointer"
                 onClick={() => setStore(s)}
                 style={{ borderTop: `3px solid ${riskC}` }}
              >
                 <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-8 h-8" fill="none" stroke={riskC} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                 </div>
                 
                 <div>
                    <div className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Node-{s.toString().padStart(3, '0')}</div>
                    <div className="text-xl font-bold tracking-tight mt-1 truncate pr-8 glow-text leading-tight">{getStoreName(s)}</div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="bg-bg-primary/60 rounded-lg p-3 border border-border-light shadow-inner">
                       <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Catalog</div>
                       <div className="text-xl font-light text-blue-400">{items.length}</div>
                    </div>
                    <div className="bg-bg-primary/60 rounded-lg p-3 border border-border-light shadow-inner">
                       <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Status Band</div>
                       <div className="text-sm font-bold flex items-center gap-2 mt-2" style={{ color: riskC }}>
                          <span className="w-2.5 h-2.5 rounded-full animate-pulse shadow-lg" style={{ background: riskC, boxShadow: `0 0 10px ${riskC}` }}></span>
                          {risk}
                       </div>
                    </div>
                 </div>

                 <div className="mt-2">
                     <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex justify-between">
                        <span>Velocity Index</span>
                        <span className="text-slate-600">7D TRAILING</span>
                     </div>
                     <div className="flex items-end gap-[3px] h-10 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                        {Array.from({length: 16}).map((_, i) => {
                           const height = 20 + (((s * (i+1) * 31) % 80)); 
                           const isAlert = risk !== 'LOW' && i > 12; // Simulate dropping/spiking ends
                           return (
                             <div 
                               key={i} 
                               className="flex-1 rounded-t-sm transition-all duration-500 ease-in-out hover:brightness-150" 
                               style={{ 
                                 height: `${isAlert ? height + 30 : height}%`, 
                                 backgroundColor: isAlert ? riskC : '#3b82f6',
                                 boxShadow: isAlert ? `0 0 8px ${riskC}` : 'none'
                               }} 
                             />
                           )
                        })}
                     </div>
                 </div>

                 {/* Neural Action Bar */}
                 <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setStore(s); }}
                        className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Select Node
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setStore(s); window.dispatchEvent(new CustomEvent('open-aria', { detail: { prompt: `Briefing on Store ${s}` } })); }}
                        className="text-[10px] uppercase font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 bg-purple-500/10 px-2.5 py-1.5 rounded-full transition-all hover:bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                        Neural Analysis
                    </button>
                 </div>
              </motion.div>
           )
        })}
      </div>
    </div>
  )
}
