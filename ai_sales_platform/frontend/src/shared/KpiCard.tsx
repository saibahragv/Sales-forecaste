import { motion } from 'framer-motion'
import React from 'react'

export function KpiCard(props: { label: string; value: React.ReactNode; delta?: React.ReactNode; onClick?: () => void }) {
  const clickable = Boolean(props.onClick)
  return (
    <button
      type="button"
      className={`w-full text-left rounded-xl bg-bg-surface border border-border-light shadow-md p-4 transition-all duration-300 ${clickable ? 'cursor-pointer hover:bg-bg-secondary hover:border-accent-hover hover:shadow-[0_0_15px_var(--accent-glow)] transform hover:-translate-y-1' : ''}`}
      onClick={props.onClick}
      disabled={!clickable}
    >
      <div className="text-xs text-fg-muted uppercase tracking-widest font-semibold">{props.label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <motion.div
          className="text-3xl font-bold tracking-tight glow-text"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {props.value}
        </motion.div>
        {props.delta && <div className="text-xs font-semibold text-fg-secondary">{props.delta}</div>}
      </div>
      {clickable && <div className="mt-3 text-[10px] text-accent-hover opacity-70 group-hover:opacity-100">Click to see what this means</div>}
    </button>
  )
}
