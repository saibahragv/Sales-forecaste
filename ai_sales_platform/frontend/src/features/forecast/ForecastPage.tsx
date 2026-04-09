import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { Panel } from '../../shared/Panel'
import { KpiCard } from '../../shared/KpiCard'
import { ExplanationDrawer, MetricExplanation } from '../../shared/ExplanationDrawer'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

type ForecastResponse = {
  store: number
  item: number
  anchor_date: string
  horizon_days: number
  predicted_total: number
  aggregation: string
  normalized: boolean
  forecast: { date: string; predicted_sales: number }[]
  history: { date: string; actual_sales: number }[]
  confidence: { date: string; lower: number; upper: number }[]
  decomposition: { date: string; trend: number; seasonal: number; residual: number }[]
  explanations: Record<string, MetricExplanation>
}

export function ForecastPage() {
  const { store, item, horizonDays, anchorDate, aggregation, normalize, showConfidence } = useFiltersStore()
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      .get<ForecastResponse>('/forecast', {
        params: {
          store,
          item,
          horizon_days: horizonDays,
          anchor_date: anchorDate,
          aggregation,
          include_history: true,
          include_confidence: showConfidence,
          normalize,
          history_days: 180,
        },
      })
      .then((r) => setForecast(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Forecast failed'))
      .finally(() => setLoading(false))
  }, [store, item, horizonDays, anchorDate, aggregation, showConfidence, normalize])

  const chartData = useMemo(() => {
    const hist = new Map((forecast?.history ?? []).map((p) => [p.date, p.actual_sales]))
    const f = new Map((forecast?.forecast ?? []).map((p) => [p.date, p.predicted_sales]))
    const conf = new Map((forecast?.confidence ?? []).map((p) => [p.date, { lower: p.lower, upper: p.upper }]))

    const dates = Array.from(new Set([...hist.keys(), ...f.keys()])).sort()
    return dates.map((d) => ({
      date: d,
      actual: hist.get(d),
      forecast: f.get(d),
      lower: conf.get(d)?.lower,
      upper: conf.get(d)?.upper,
    }))
  }, [forecast])

  const decompData = useMemo(() => {
    return forecast?.decomposition ?? []
  }, [forecast])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <KpiCard label="Forecast Total" value={forecast ? forecast.predicted_total.toFixed(0) : '—'} />
        <KpiCard label="Store" value={store !== undefined ? String(store) : '—'} />
        <KpiCard label="Item" value={item !== undefined ? String(item) : '—'} />
        <KpiCard label="Horizon" value={`${horizonDays} days`} />
      </div>

      <Panel title="Forecast Explorer" right={loading ? <div className="text-xs text-slate-400">Loading…</div> : null}>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937' }} />
              <Legend />
              {showConfidence && (
                <Line
                  type="monotone"
                  dataKey="upper"
                  stroke="#60a5fa"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  opacity={0.55}
                />
              )}
              {showConfidence && (
                <Line
                  type="monotone"
                  dataKey="lower"
                  stroke="#60a5fa"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  opacity={0.55}
                />
              )}
              <Line type="monotone" dataKey="actual" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="forecast" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <button
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900"
            onClick={() => openExplain('forecast_aggregation')}
            disabled={!forecast}
          >
            Aggregation: {aggregation}
            <div className="mt-1 text-[11px] text-slate-500">Definition · calculation · meaning</div>
          </button>
          <button
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900"
            onClick={() => openExplain('forecast_normalization')}
            disabled={!forecast}
          >
            Normalization: {normalize ? 'On' : 'Off'}
            <div className="mt-1 text-[11px] text-slate-500">Interpretation rules</div>
          </button>
          <button
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => openExplain('confidence_band_pct')}
            disabled={!forecast || !showConfidence}
          >
            Uncertainty band
            <div className="mt-1 text-[11px] text-slate-500">Risk envelope from volatility</div>
          </button>
          <button
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-900"
            onClick={() => openExplain('forecast_decomposition')}
            disabled={!forecast}
          >
            Decomposition
            <div className="mt-1 text-[11px] text-slate-500">Trend · seasonal · residual</div>
          </button>
        </div>
        {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
      </Panel>

      <Panel title="Forecast Decomposition (Deterministic)">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decompData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937' }} />
              <Legend />
              <Line type="monotone" dataKey="trend" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="seasonal" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="residual" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        explanation={selectedKey && forecast ? forecast.explanations[selectedKey] ?? null : null}
        metricKey={selectedKey ?? undefined}
      />
    </div>
  )
}
