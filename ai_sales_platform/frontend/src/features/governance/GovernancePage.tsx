import { useEffect, useState } from 'react'
import { api } from '../../core/api'
import { Panel } from '../../shared/Panel'

type GovernanceResponse = {
  model_version: string
  feature_count: number
  features: string[]
  training_data_window: string
  last_retrained_date: string
  validation_smape: number | null
  drift_indicator: number | null
  notes: string
}

export function GovernancePage() {
  const [g, setG] = useState<GovernanceResponse | null>(null)

  useEffect(() => {
    api.get<GovernanceResponse>('/model/governance').then((r) => setG(r.data))
  }, [])

  return (
    <div className="space-y-6">
      <Panel title="Model Governance">
        {!g ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">Model version</div>
              <div className="mt-1 text-sm text-slate-100">{g.model_version}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">Training data window</div>
              <div className="mt-1 text-sm text-slate-100">{g.training_data_window}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">Feature count</div>
              <div className="mt-1 text-sm text-slate-100">{g.feature_count}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">Last retrained</div>
              <div className="mt-1 text-sm text-slate-100">{g.last_retrained_date}</div>
            </div>
            <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs text-slate-400">Features</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.features.map((f) => (
                  <span key={f} className="rounded-md border border-slate-800 bg-panel-950 px-2 py-1 text-xs text-slate-200">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 text-xs text-slate-400">{g.notes}</div>
          </div>
        )}
      </Panel>
    </div>
  )
}
