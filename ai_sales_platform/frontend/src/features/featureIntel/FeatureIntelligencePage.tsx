import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { Panel } from '../../shared/Panel'
import { Skeleton } from '../../shared/Skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type ShapGlobalResponse = {
  status: 'computing' | 'ready' | 'failed'
  scope: string
  top_features: { feature: string; mean_abs_shap: number }[]
}

type ShapLocalResponse = {
  store: number
  item: number
  target_date: string
  prediction: number
  base_value: number
  summary: string
  contributions: { feature: string; value: number; shap: number }[]
}

type FeaturesResponse = {
  scope: string
  feature_count: number
  feature_groups: { name: string; features: string[] }[]
  snapshot: { feature: string; value: number }[]
  top_correlations: { feature_a: string; feature_b: string; corr: number }[]
  model_features: string[]
}

export function FeatureIntelligencePage() {
  const { store, item, anchorDate } = useFiltersStore()
  const [globalResp, setGlobalResp] = useState<ShapGlobalResponse | null>(null)
  const [localResp, setLocalResp] = useState<ShapLocalResponse | null>(null)
  const [featuresResp, setFeaturesResp] = useState<FeaturesResponse | null>(null)
  const [targetDate, setTargetDate] = useState(anchorDate ?? '2017-12-31')
  const [loadingLocal, setLoadingLocal] = useState(false)
  const [globalErr, setGlobalErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: any = null

    const tick = async () => {
      try {
        const r = await api.get<ShapGlobalResponse>('/shap/global')
        if (cancelled) return
        setGlobalResp(r.data)
        setGlobalErr(null)
        if (r.data.status === 'computing') {
          timer = setTimeout(tick, 2500)
        }
      } catch (e: any) {
        if (cancelled) return
        setGlobalErr(e?.response?.data?.detail ?? e?.message ?? 'SHAP global failed')
        timer = setTimeout(tick, 5000)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    api
      .get<FeaturesResponse>('/features', { params: { store, item, anchor_date: anchorDate } })
      .then((r) => setFeaturesResp(r.data))
  }, [store, item, anchorDate])

  const fetchLocal = async () => {
    if (store === undefined || item === undefined) return
    setLoadingLocal(true)
    const dt = targetDate || anchorDate || '2017-12-31'
    const r = await api.get<ShapLocalResponse>('/shap/local', { params: { store, item, target_date: dt } })
    setLocalResp(r.data)
    setLoadingLocal(false)
  }

  const barData = useMemo(() => {
    const top = globalResp?.top_features ?? []
    return [...top].reverse()
  }, [globalResp])

  const corrRows = useMemo(() => featuresResp?.top_correlations ?? [], [featuresResp])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Global Feature Importance" right={<div className="text-xs text-slate-400">{globalResp?.status ?? '—'}</div>}>
          {globalResp?.status === 'computing' && (
            <div className="text-sm text-slate-300">Computing SHAP importance in background. Refresh in a moment.</div>
          )}
          {globalResp?.status === 'failed' && <div className="text-sm text-rose-300">SHAP computation failed. Try again later.</div>}
          {globalErr && <div className="mt-2 text-xs text-rose-300">{globalErr}</div>}
          {!globalResp ? (
            <div className="mt-3">
              <Skeleton className="h-72 w-full animate-pulse rounded bg-slate-800/60" />
            </div>
          ) : (
            <div className="h-[360px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 30, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 12 }} width={140} />
                  <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937' }} />
                  <Bar dataKey="mean_abs_shap" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Feature Inventory & Correlations">
          {!featuresResp ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3 animate-pulse rounded bg-slate-800/60" />
              <Skeleton className="h-48 w-full animate-pulse rounded bg-slate-800/60" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">Engineered features</div>
                  <div className="mt-1 text-sm text-slate-200">{featuresResp.feature_count}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">Model features</div>
                  <div className="mt-1 text-sm text-slate-200">{featuresResp.model_features.length}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">Scope</div>
                  <div className="mt-1 text-sm text-slate-200">{featuresResp.scope}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Top correlations</div>
                <div className="mt-2 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950">
                  {corrRows.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400">No high correlations in current window.</div>
                  ) : (
                    corrRows.map((r) => (
                      <div key={`${r.feature_a}:${r.feature_b}`} className="flex items-center justify-between p-3">
                        <div className="text-sm text-slate-200">{r.feature_a} ↔ {r.feature_b}</div>
                        <div className="text-xs text-slate-400">{r.corr.toFixed(3)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Local Explanation (SHAP Waterfall Summary)" right={loadingLocal ? <div className="text-xs text-slate-400">Computing…</div> : null}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="text-xs text-slate-400">Target date</div>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
              onClick={fetchLocal}
              disabled={store === undefined || item === undefined || loadingLocal}
            >
              Explain
            </button>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-slate-400">Summary</div>
            <div className="mt-2 text-sm text-slate-200">{localResp?.summary ?? '—'}</div>
          </div>
        </div>

        {localResp && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs text-slate-400">Prediction</div>
              <div className="mt-1 text-sm text-slate-200">{localResp.prediction.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs text-slate-400">Base value</div>
              <div className="mt-1 text-sm text-slate-200">{localResp.base_value.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs text-slate-400">Top driver</div>
              <div className="mt-1 text-sm text-slate-200">{localResp.contributions[0]?.feature ?? '—'}</div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
