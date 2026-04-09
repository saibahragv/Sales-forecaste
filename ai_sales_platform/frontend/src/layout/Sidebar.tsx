import { NavLink } from 'react-router-dom'
import {
  Bars3Icon,
  ChartBarIcon,
  BeakerIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  PresentationChartLineIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const nav = [
  { to: '/overview', label: 'Executive Overview', icon: PresentationChartLineIcon },
  { to: '/forecast', label: 'Forecast Explorer', icon: ChartBarIcon },
  { to: '/scenario', label: 'Scenario Simulation Lab', icon: BeakerIcon },
  { to: '/risk', label: 'Risk & Stability', icon: ExclamationTriangleIcon },
  { to: '/feature-intelligence', label: 'Feature Intelligence', icon: CircleStackIcon },
  { to: '/hierarchy', label: 'Hierarchical Intelligence', icon: Squares2X2Icon },
  { to: '/seasonal-trend', label: 'Seasonal & Trend Lab', icon: ChartPieIcon },
  { to: '/governance', label: 'Governance & Monitoring', icon: ShieldCheckIcon },
  { to: '/data-engineering', label: 'Data Engineering Console', icon: WrenchScrewdriverIcon },
  { to: '/assistant', label: 'AI Assistant', icon: ChatBubbleLeftRightIcon },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside 
      className={clsx('bg-bg-secondary h-screen flex flex-col pt-4 overflow-y-auto overflow-x-hidden')}
      animate={{ width: collapsed ? 80 : 300 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between px-4 pb-6 border-b border-border-light mb-4">
        {!collapsed && (
           <motion.div initial={{opacity:0}} animate={{opacity:1}} className="font-semibold tracking-tight glow-text whitespace-nowrap">
             Workspaces
           </motion.div>
        )}
        <button
          className="btn-magnetic w-10 h-10 flex items-center justify-center p-0 ml-auto"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      </div>

      <nav className="px-3 flex-1 flex flex-col gap-2">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              clsx(
                'relative group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300',
                isActive ? 'bg-bg-surface text-white shadow-lg border border-border-light' : 'text-fg-secondary hover:bg-bg-surface hover:text-white',
              )
            }
          >
           {({ isActive }) => (
             <>
               <n.icon className={clsx("h-6 w-6 transition-transform group-hover:scale-110", isActive ? "text-accent-hover" : "")} />
               {!collapsed && (
                  <motion.span initial={{opacity:0}} animate={{opacity:1}} transition={{delay: 0.1}} className="whitespace-nowrap">
                    {n.label}
                  </motion.span>
               )}
               {/* Tooltip for collapsed state */}
               {collapsed && (
                 <div className="absolute left-16 px-3 py-2 bg-bg-primary border border-border-light text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                    {n.label}
                 </div>
               )}
             </>
           )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-6 py-6 text-xs text-fg-muted border-t border-border-light mt-auto">
          Connected to WebSocket
        </div>
      )}
    </motion.aside>
  )
}
