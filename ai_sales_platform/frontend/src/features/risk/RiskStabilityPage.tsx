import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { Panel } from '../../shared/Panel'
import { KpiCard } from '../../shared/KpiCard'
import { Skeleton } from '../../shared/Skeleton'
import { ExportModal } from '../../shared/ExportModal'
import { ExplanationDrawer, MetricExplanation } from '../../shared/ExplanationDrawer'

type RiskResponse = {
  store: number
  item: number
  horizon_days: number
  volatility_score: number
  stability_index: number
  anomaly_flag: boolean
  confidence_band_pct: number
  explanations: Record<string, MetricExplanation>
}

export function RiskStabilityPage() {
  const { store, item, horizonDays } = useFiltersStore()
  const [resp, setResp] = useState<RiskResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const openExplain = (key: string) => {
    setSelectedKey(key)
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (store === undefined || item === undefined) return
    setLoading(true)
    setError(null)
    api
      .get<RiskResponse>('/risk', { params: { store, item, horizon_days: horizonDays } })
      .then((r) => setResp(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Risk failed'))
      .finally(() => setLoading(false))
  }, [store, item, horizonDays])

  const riskClass = useMemo(() => {
    if (!resp) return '—'
    if (resp.anomaly_flag) return 'elevated'
    if (resp.volatility_score > 0.35) return 'high'
    if (resp.volatility_score > 0.20) return 'medium'
    return 'low'
  }, [resp])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <KpiCard label="Volatility" value={resp ? resp.volatility_score.toFixed(3) : '—'} onClick={resp ? () => openExplain('volatility_score') : undefined} />
        <KpiCard label="Stability Index" value={resp ? resp.stability_index.toFixed(3) : '—'} onClick={resp ? () => openExplain('stability_index') : undefined} />
        <KpiCard label="Uncertainty Band" value={resp ? `±${resp.confidence_band_pct.toFixed(1)}%` : '—'} onClick={resp ? () => openExplain('confidence_band_pct') : undefined} />
        <KpiCard label="Risk Class" value={riskClass} onClick={resp ? () => openExplain('risk_score') : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Risk Classification" right={loading ? <div className="text-xs text-slate-400">Computing…</div> : null}>
          {!resp && loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/2 animate-pulse rounded bg-slate-800/60" />
              <Skeleton className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-200">Classification: {riskClass}</div>
              <div className="text-xs text-slate-400">Anomaly flag: {resp ? String(resp.anomaly_flag) : '—'}</div>
              <div className="text-xs text-slate-400">
                Interpretation: stability is a bounded inverse-volatility index; uncertainty band scales with volatility.
              </div>
            </div>
          )}
          {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
        </Panel>

        <Panel title="Risk Driver Breakdown">
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Primary drivers (deterministic)</div>
            <div className="text-sm text-slate-200">Trailing volatility</div>
            <div className="text-sm text-slate-200">Trailing stability</div>
            <div className="text-sm text-slate-200">Anomaly detection on last observation</div>
            <div className="text-xs text-slate-500">Use Feature Intelligence to inspect rolling std/cv and anomaly z-score features.</div>
          </div>
        </Panel>

        <Panel
          title="Export Risk Metrics"
          right={
            <button
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-50"
              onClick={() => setExportOpen(true)}
              disabled={!resp}
            >
              Export
            </button>
          }
        >
          <div className="text-sm text-slate-300">Export includes computed volatility, stability, anomaly flag, and uncertainty band.</div>
        </Panel>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Risk & Stability Export"
        payload={resp ?? {}}
        filename={`risk_${store ?? 'na'}_${item ?? 'na'}.json`}
      />

      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        explanation={selectedKey && resp ? resp.explanations[selectedKey] ?? null : null}
        metricKey={selectedKey ?? undefined}
      />
    </div>
  )
}
