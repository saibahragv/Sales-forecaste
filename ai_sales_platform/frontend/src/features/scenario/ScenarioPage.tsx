import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'

type ScenarioAdjustment = {
  price_elasticity: number
  promotion_intensity: number
  macro_demand_shock_pct: number
  growth_slope: number
  marketing_spend: number
  competitor_presence: number
  weather_impact: number
}

const DEFAULT_ADJUSTMENT: ScenarioAdjustment = {
  price_elasticity: 0.0,
  promotion_intensity: 0.0,
  macro_demand_shock_pct: 0.0,
  growth_slope: 0.0,
  marketing_spend: 0.0,
  competitor_presence: 0.0,
  weather_impact: 0.0
}

export function ScenarioPage() {
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  
  // Matrix setup: We allow up to 3 scenarios
  const [scenarios, setScenarios] = useState<ScenarioAdjustment[]>([
     { ...DEFAULT_ADJUSTMENT },
     { ...DEFAULT_ADJUSTMENT, promotion_intensity: 0.15 },
     { ...DEFAULT_ADJUSTMENT, price_elasticity: -0.2 }
  ]);
  const [activeTab, setActiveTab] = useState(0);

  const handleUpdate = (key: keyof ScenarioAdjustment, value: number) => {
     setScenarios(prev => {
        const next = [...prev];
        next[activeTab] = { ...next[activeTab], [key]: value };
        return next;
     });
  }

  return (
    <div className="space-y-6 relative overflow-hidden">
        {/* Background Grid CSS Animation effect */}
        <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTAgMGgyeTRIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20 pointer-events-none mix-blend-screen" />

        <GlobalFilters />

        <div className="flex items-center justify-between z-10 relative">
           <div>
              <h2 className="text-2xl font-bold glow-text mb-1">Advanced Matrix Scenario Lab</h2>
              <p className="text-sm text-fg-muted">Run simultaneous multi-scenario combinations in sandbox.</p>
           </div>
        </div>

        <div className="split-pane h-[600px] glass-panel p-0 z-10 relative overflow-hidden">
            <div className="w-[350px] border-r border-border-light bg-bg-secondary flex flex-col">
               <div className="p-4 border-b border-border-light flex space-x-2">
                 {scenarios.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => setActiveTab(i)}
                      className={`flex-1 py-1 text-sm rounded ${activeTab === i ? 'bg-accent-base text-white shadow-lg' : 'bg-bg-surface text-fg-muted hover:bg-bg-primary'}`}
                    >
                      S{i+1}
                    </button>
                 ))}
               </div>

               <div className="p-4 overflow-y-auto space-y-4">
                  {Object.keys(DEFAULT_ADJUSTMENT).map(key => {
                     const typedKey = key as keyof ScenarioAdjustment;
                     return (
                         <div key={key} className="space-y-1">
                            <div className="flex justify-between text-xs text-fg-secondary uppercase tracking-widest font-semibold">
                               <span>{key.replace(/_/g, ' ')}</span>
                               <span>{scenarios[activeTab][typedKey].toFixed(2)}</span>
                            </div>
                            <input 
                               type="range" 
                               min="-1" max="1" step="0.01" 
                               value={scenarios[activeTab][typedKey]} 
                               onChange={(e) => handleUpdate(typedKey, parseFloat(e.target.value))}
                               className="w-full h-1 bg-bg-primary rounded-lg appearance-none cursor-pointer"
                            />
                         </div>
                     );
                  })}
               </div>
            </div>
            
            <div className="flex-1 bg-black/50 p-6 relative flex flex-col items-center justify-center">
                 {/* WebGL/Canvas Chart Placeholder */}
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-full border border-border-light rounded-xl overflow-hidden bg-bg-surface relative shadow-2xl flex items-center justify-center"
                 >
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary to-transparent opacity-50 z-0" />
                    
                    {/* Simulated Graph Lines for 3 Scenarios */}
                    <div className="flex items-end w-full h-[80%] px-10 z-10 opacity-70">
                        {Array.from({length: 20}).map((_, i) => (
                           <div key={i} className="flex-1 flex flex-col justify-end items-center mr-1">
                              <motion.div 
                                 initial={{ height: 0 }} 
                                 animate={{ height: `${20 + (i * 2) + (scenarios[0].price_elasticity * 50)}%` }} 
                                 className="w-full bg-accent-base rounded-t-sm"
                              />
                           </div>
                        ))}
                    </div>

                    <div className="absolute top-4 left-4 p-4 glass-panel z-20">
                       <div className="text-sm font-bold mb-2">Simulated Matrix Output</div>
                       <div className="text-xs flex items-center text-accent-base"><span className="w-2 h-2 bg-accent-base mr-2" /> Baseline Interaction</div>
                       <div className="text-xs flex items-center text-risk-med"><span className="w-2 h-2 bg-risk-med mr-2" /> Volatility Overlay</div>
                    </div>
                 </motion.div>
            </div>
        </div>
    </div>
  )
}
