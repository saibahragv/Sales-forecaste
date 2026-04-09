import { useEffect, useMemo, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { KpiCard } from '../../shared/KpiCard'
import { Panel } from '../../shared/Panel'
import { Skeleton } from '../../shared/Skeleton'
import { ExportModal } from '../../shared/ExportModal'
import { ExplanationDrawer, MetricExplanation } from '../../shared/ExplanationDrawer'

type OverviewResponse = {
  scope: string
  anchor_date: string
  horizon_days: number
  kpis: { label: string; value: number; unit?: string | null; delta?: number | null; delta_pct?: number | null }[]
  trend: { slope_30d: number; r2_30d: number; direction: string }
  demand_health: { score: number; band: string; drivers: string[] }
  forecast_total: number
  baseline_total: number
  forecast_delta: number
  forecast_delta_pct: number | null
  export_payload: any
  explanations: Record<string, MetricExplanation>
}

// Animated Counter Hook
const AnimatedCounter = ({ value }: { value: number | string | undefined }) => {
  if (value === undefined) return null;
  if (typeof value === 'string' && isNaN(Number(value))) return <span>{value}</span>;
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={value as any}
      transition={{ type: "spring", stiffness: 100 }}
    >
      {value}
    </motion.span>
  );
};

export function ExecutiveOverviewPage() {
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  const [resp, setResp] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 50]);

  const openExplain = (key: string) => {
    setSelectedKey(key)
    setDrawerOpen(true)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<OverviewResponse>('/overview', {
        params: {
          store,
          item,
          horizon_days: horizonDays,
          anchor_date: anchorDate,
        },
      })
      .then((r) => setResp(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Overview failed'))
      .finally(() => setLoading(false))
  }, [store, item, horizonDays, anchorDate])

  const kpiMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const k of resp?.kpis ?? []) m[k.label] = k.value
    return m
  }, [resp])

  const trendLabel = resp ? `${resp.trend.direction.toUpperCase()} (R² ${resp.trend.r2_30d.toFixed(2)})` : '—'
  const healthLabel = resp ? `${resp.demand_health.band.toUpperCase()} (${(resp.demand_health.score * 100).toFixed(0)}%)` : '—'

  return (
    <div className="space-y-8 relative">
      
      {/* Parallax Background */}
      <motion.div 
         style={{ y: y1 }}
         className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-glow blur-[100px] rounded-full opacity-20 pointer-events-none -z-10" 
      />

      <GlobalFilters />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 z-10 relative">
        <KpiCard
          label="Growth"
          value={<AnimatedCounter value={resp ? kpiMap['Growth (30d)']?.toFixed(0) ?? '0' : '—'} />}
          delta={<AnimatedCounter value={resp ? `${(resp.kpis.find((k) => k.label === 'Growth (30d)')?.delta_pct ?? 0).toFixed(2)}%` : undefined} />}
          onClick={resp ? () => openExplain('growth_30d_pct') : undefined}
        />
        <KpiCard label="Volatility" value={<AnimatedCounter value={resp ? kpiMap['Volatility']?.toFixed(3) ?? '0.000' : '—'} />} onClick={resp ? () => openExplain('volatility_score') : undefined} />
        <KpiCard label="Stability" value={<AnimatedCounter value={resp ? kpiMap['Stability']?.toFixed(3) ?? '0.000' : '—'} />} onClick={resp ? () => openExplain('stability_index') : undefined} />
        <KpiCard label="Risk" value={<AnimatedCounter value={resp ? kpiMap['Risk']?.toFixed(3) ?? '0.000' : '—'} />} onClick={resp ? () => openExplain('risk_score') : undefined} />
        <KpiCard
          label="Forecast Delta"
          value={<AnimatedCounter value={resp ? resp.forecast_delta.toFixed(0) : '—'} />}
          delta={<AnimatedCounter value={resp?.forecast_delta_pct != null ? `${resp.forecast_delta_pct.toFixed(2)}%` : undefined} />}
          onClick={resp ? () => openExplain('forecast_delta_pct') : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          title="Trend Strength"
          right={loading ? <div className="text-xs text-accent-base animate-pulse">Computing Matrix…</div> : null}
          className="glass-panel"
        >
          {!resp && loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="text-sm font-bold glow-text">{trendLabel}</div>
              <div className="text-xs text-fg-secondary">Slope (30d): {resp ? resp.trend.slope_30d.toFixed(2) : '—'}</div>
              <div className="text-xs text-fg-secondary">Scope: {resp?.scope ?? '—'}</div>
            </motion.div>
          )}
        </Panel>

        <Panel title="Demand Health" className="glass-panel">
          {!resp && loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-20 w-full" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="text-sm font-bold glow-text">{healthLabel}</div>
              <div className="rounded-lg bg-bg-surface p-3 border border-border-light shadow-inner">
                <div className="text-xs text-fg-secondary uppercase tracking-widest font-semibold mb-2">Drivers</div>
                <div className="space-y-2">
                  {(resp?.demand_health.drivers ?? []).map((d, i) => (
                    <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} key={d} className="text-xs bg-bg-secondary p-1.5 rounded text-white flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-base mr-2" />
                      {d}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </Panel>

        <Panel
          title="Export Metrics"
          className="glass-panel"
          right={
            <button
              className="btn-magnetic bg-accent-base text-white border-0 text-xs px-4"
              onClick={() => setExportOpen(true)}
              disabled={!resp}
            >
              Compile Report
            </button>
          }
        >
          <div className="text-sm text-fg-secondary">Export includes KPIs, trend metrics, and demand health drivers structured for PDF/JSON reports.</div>
          {error && <div className="mt-2 text-xs text-risk-high">{error}</div>}
        </Panel>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Executive Overview Export"
        payload={resp?.export_payload ?? {}}
        filename={`overview_${store ?? 'all'}_${item ?? 'all'}.json`}
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
