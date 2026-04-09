import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { AIAssistantBubble } from './AIAssistantBubble'
import { usePageContext } from '../store/pageContext'
import { useFiltersStore } from '../store/filters'
import { getStoreName, getItemName } from '../core/mappings'

const PAGE_TITLES: Record<string, [string, string]> = {
  '/overview':           ['Executive Pulse',         'Sales health, trends & KPIs'],
  '/forecast':           ['Forecast Explorer',       'Predictive model output'],
  '/scenario':           ['Scenario Simulator',      'Endless real-time what-if simulations'],
  '/hierarchy':          ['Global Store Network',    'Interactive store and item topology map'],
}

export function AppLayout() {
  const location = useLocation()
  const { setCurrentPage } = usePageContext()

  useEffect(() => {
    setCurrentPage(location.pathname)
  }, [location.pathname, setCurrentPage])

  const { store, item } = useFiltersStore()
  const [title, subtitle] = PAGE_TITLES[location.pathname] ?? ['Operations', '']

  return (
    <div className="min-h-screen">
      <CommandPalette />
      <AIAssistantBubble />
      <div className="split-pane">
        <div className="split-pane-left">
          <Sidebar />
        </div>
        <main className="split-pane-right relative">
          {/* Top bar */}
          <div className="sticky top-0 z-10 border-b border-border-light bg-bg-glass backdrop-blur rounded-xl mb-4 px-6 py-3 flex justify-between items-center">
            <div>
              <div className="text-xs text-fg-muted font-bold tracking-widest uppercase">AI Sales Intelligence Platform</div>
              <div className="text-xl font-semibold tracking-tight glow-text">{title}</div>
              {subtitle && <div className="text-xs text-fg-muted mt-0.5 opacity-70">{subtitle}</div>}
            </div>
            <div className="text-xs text-fg-secondary bg-bg-primary border border-border-light rounded-lg px-3 py-2">
              Viewing: <strong className="text-white glow-text">{store ? getStoreName(store) : 'Global'}</strong> 
              {item && <span> / <strong className="text-white glow-text">{getItemName(item)}</strong></span>}
            </div>
          </div>

          <motion.div
            key={location.pathname}
            className="w-full bg-bg-secondary border border-border-light rounded-xl p-6 shadow-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
