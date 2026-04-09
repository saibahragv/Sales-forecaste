import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'

export type MetricExplanation = {
  title: string
  definition: string
  calculation_logic: string
  business_meaning: string
  current_interpretation: string
  reasoning: string[]
  suggested_action?: string | null
}

export function ExplanationDrawer(props: {
  open: boolean
  onClose: () => void
  explanation: MetricExplanation | null
  metricKey?: string
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-stretch justify-end">
        <DialogPanel className="h-full w-full max-w-lg overflow-auto border-l border-slate-800 bg-panel-950 shadow-panel">
          <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <DialogTitle as="div" className="text-xl font-bold glow-text">
                {props.explanation?.title ?? 'Metric explanation'}
              </DialogTitle>
            </div>
            <button className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-900" onClick={props.onClose}>
              Close
            </button>
          </div>

          {!props.explanation ? (
            <div className="p-4 text-sm text-slate-400">No explanation available for this metric.</div>
          ) : (
            <div className="p-4 space-y-4">
              <section className="glass-panel p-4">
                <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">What is this?</div>
                <div className="mt-2 text-sm text-fg-primary leading-relaxed">{props.explanation.definition}</div>
              </section>

              <section className="glass-panel p-4 border-l-4 border-accent-base pl-3">
                <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">What this means for the business</div>
                <div className="mt-2 text-sm text-white font-medium leading-relaxed">{props.explanation.business_meaning}</div>
              </section>

              <section className="glass-panel p-4 bg-bg-surface">
                <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">Current Status</div>
                <div className="mt-2 text-lg text-white font-semibold glow-text">{props.explanation.current_interpretation}</div>
              </section>

              {props.explanation.suggested_action && (
                <section className="glass-panel p-4 border border-risk-medium border-opacity-30">
                  <div className="text-xs font-bold text-risk-medium uppercase tracking-wider">Suggested action</div>
                  <div className="mt-2 text-sm text-white">{props.explanation.suggested_action}</div>
                </section>
              )}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
