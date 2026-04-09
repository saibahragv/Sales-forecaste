import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { Panel } from '../../shared/Panel'
import { Skeleton } from '../../shared/Skeleton'

type FeaturesResponse = {
  scope: string
  feature_count: number
  feature_groups: { name: string; features: string[] }[]
  snapshot: { feature: string; value: number }[]
  top_correlations: { feature_a: string; feature_b: string; corr: number }[]
}

export function DataEngineeringConsolePage() {
  const { store, item, anchorDate } = useFiltersStore()
  const [resp, setResp] = useState<FeaturesResponse | null>(null)
  const [enabledGroups, setEnabledGroups] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get<FeaturesResponse>('/features', { params: { store, item, anchor_date: anchorDate, lookback_days: 180 } })
      .then((r) => {
        setResp(r.data)
        const next: Record<string, boolean> = {}
        for (const g of r.data.feature_groups) next[g.name] = true
        setEnabledGroups(next)
      })
      .finally(() => setLoading(false))
  }, [store, item, anchorDate])

  const enabledFeatureCount = useMemo(() => {
    if (!resp) return 0
    let c = 0
    for (const g of resp.feature_groups) {
      if (enabledGroups[g.name]) c += g.features.length
    }
    return c
  }, [resp, enabledGroups])

  const snapshotRows = useMemo(() => {
    if (!resp) return []
    const enabled = new Set<string>()
    for (const g of resp.feature_groups) {
      if (!enabledGroups[g.name]) continue
      for (const f of g.features) enabled.add(f)
    }
    return (resp.snapshot ?? [])
      .filter((s) => enabled.has(s.feature))
      .slice(0, 40)
  }, [resp, enabledGroups])

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Feature Group Toggles" right={loading ? <div className="text-xs text-slate-400">Loading…</div> : null}>
          {!resp && loading ? (
            <Skeleton className="h-44 w-full animate-pulse rounded bg-slate-800/60" />
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">Enabled features: {enabledFeatureCount}</div>
              {(resp?.feature_groups ?? []).map((g) => (
                <label key={g.name} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                  <div>
                    <div className="text-sm text-slate-200">{g.name}</div>
                    <div className="text-[11px] text-slate-500">{g.features.length} features</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabledGroups[g.name] ?? false}
                    onChange={(e) => setEnabledGroups((p) => ({ ...p, [g.name]: e.target.checked }))}
                  />
                </label>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Raw vs Engineered (Snapshot)">
          {!resp && loading ? (
            <Skeleton className="h-44 w-full animate-pulse rounded bg-slate-800/60" />
          ) : (
            <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950">
              {snapshotRows.map((r) => (
                <div key={r.feature} className="flex items-center justify-between p-3">
                  <div className="text-sm text-slate-200">{r.feature}</div>
                  <div className="text-xs text-slate-400">{Number.isFinite(r.value) ? r.value.toFixed(4) : '—'}</div>
                </div>
              ))}
              {snapshotRows.length === 0 && <div className="p-3 text-sm text-slate-400">No snapshot features enabled.</div>}
            </div>
          )}
        </Panel>

        <Panel title="Feature Correlation Matrix (Top Pairs)">
          {!resp && loading ? (
            <Skeleton className="h-44 w-full animate-pulse rounded bg-slate-800/60" />
          ) : (
            <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950">
              {(resp?.top_correlations ?? []).map((c) => (
                <div key={`${c.feature_a}:${c.feature_b}`} className="flex items-center justify-between p-3">
                  <div className="text-sm text-slate-200">{c.feature_a} ↔ {c.feature_b}</div>
                  <div className="text-xs text-slate-400">{c.corr.toFixed(3)}</div>
                </div>
              ))}
              {(resp?.top_correlations ?? []).length === 0 && <div className="p-3 text-sm text-slate-400">No high correlations detected.</div>}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Feature Importance Timeline (Control Surface)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-xs text-slate-400">Window</div>
            <select className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm" defaultValue="180">
              <option value="60">60 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-slate-400">Smoothing</div>
            <select className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm" defaultValue="ema30">
              <option value="none">None</option>
              <option value="ema7">EMA 7</option>
              <option value="ema30">EMA 30</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">
              Apply
            </button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

