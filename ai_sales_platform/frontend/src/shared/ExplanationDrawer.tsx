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
              <DialogTitle as="div" className="text-sm font-medium text-slate-200">
                {props.explanation?.title ?? 'Metric explanation'}
              </DialogTitle>
              <div className="mt-1 text-xs text-slate-500">{props.metricKey ? `key: ${props.metricKey}` : ''}</div>
            </div>
            <button className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-900" onClick={props.onClose}>
              Close
            </button>
          </div>

          {!props.explanation ? (
            <div className="p-4 text-sm text-slate-400">No explanation available for this metric.</div>
          ) : (
            <div className="p-4 space-y-4">
              <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs font-medium text-slate-300">Definition</div>
                <div className="mt-1 text-sm text-slate-200">{props.explanation.definition}</div>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs font-medium text-slate-300">Calculation logic</div>
                <div className="mt-1 text-sm text-slate-200">{props.explanation.calculation_logic}</div>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs font-medium text-slate-300">Business meaning</div>
                <div className="mt-1 text-sm text-slate-200">{props.explanation.business_meaning}</div>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs font-medium text-slate-300">Current interpretation</div>
                <div className="mt-1 text-sm text-slate-200">{props.explanation.current_interpretation}</div>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-xs font-medium text-slate-300">Reasoning</div>
                <div className="mt-2 space-y-1">
                  {props.explanation.reasoning.map((r) => (
                    <div key={r} className="text-sm text-slate-200">
                      {r}
                    </div>
                  ))}
                </div>
              </section>

              {props.explanation.suggested_action && (
                <section className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs font-medium text-slate-300">Suggested action</div>
                  <div className="mt-1 text-sm text-slate-200">{props.explanation.suggested_action}</div>
                </section>
              )}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
