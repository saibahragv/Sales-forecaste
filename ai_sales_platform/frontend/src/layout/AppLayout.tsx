import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { CopilotWidget } from './CopilotWidget'

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <CommandPalette />
      <div className="split-pane">
        <div className="split-pane-left">
           <Sidebar />
        </div>
        <main className="split-pane-right relative">
          <div className="sticky top-0 z-10 border-b border-border-light bg-bg-glass backdrop-blur interactive-hover rounded-xl mb-4 px-6 py-4 flex justify-between items-center">
            <div>
              <div className="text-sm text-fg-muted font-bold tracking-widest uppercase">AI Sales Intelligence</div>
              <div className="text-2xl font-semibold tracking-tight glow-text">Operations Analytics</div>
            </div>
            <div className="text-xs text-fg-secondary">
               Press <kbd className="bg-bg-primary border border-border-light rounded px-1 glow-text">Cmd+K</kbd> to search
            </div>
          </div>

          <motion.div
            className="w-full bg-bg-secondary border border-border-light rounded-xl p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
          
          <CopilotWidget />
        </main>
      </div>
    </div>
  )
}
