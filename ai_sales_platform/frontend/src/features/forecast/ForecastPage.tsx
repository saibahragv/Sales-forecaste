import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { usePageContext } from '../../store/pageContext'
import { Panel } from '../../shared/Panel'
import { ExplanationDrawer, MetricExplanation } from '../../shared/ExplanationDrawer'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { motion } from 'framer-motion'

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

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '10px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

export function ForecastPage() {
  const { store, item, horizonDays, anchorDate, aggregation, normalize, showConfidence } = useFiltersStore()
  const { updatePageData } = usePageContext()
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [tab, setTab] = useState<'forecast' | 'decomp'>('forecast')

  useEffect(() => {
    if (store === undefined || item === undefined) return
    setLoading(true)
    setError(null)
    api.get<ForecastResponse>('/forecast', {
      params: { store, item, horizon_days: horizonDays, anchor_date: anchorDate, aggregation, include_history: true, include_confidence: showConfidence, normalize, history_days: 90 },
    })
      .then(r => {
        setForecast(r.data)
        updatePageData({
          forecastTotal: r.data.predicted_total.toFixed(0),
          anchorDate: r.data.anchor_date,
          horizonDays: r.data.horizon_days,
          aggregation: r.data.aggregation,
        })
      })
      .catch(e => setError(e?.response?.data?.detail ?? e?.message ?? 'Forecast failed'))
      .finally(() => setLoading(false))
  }, [store, item, horizonDays, anchorDate, aggregation, showConfidence, normalize])

  const chartData = useMemo(() => {
    const hist = new Map((forecast?.history ?? []).map(p => [p.date, p.actual_sales]))
    const f = new Map((forecast?.forecast ?? []).map(p => [p.date, p.predicted_sales]))
    const conf = new Map((forecast?.confidence ?? []).map(p => [p.date, { lower: p.lower, upper: p.upper }]))
    const dates = Array.from(new Set([...hist.keys(), ...f.keys()])).sort()
    return dates.map(d => ({
      date: d.slice(5),
      actual: hist.get(d),
      forecast: f.get(d),
      lower: conf.get(d)?.lower,
      upper: conf.get(d)?.upper,
    }))
  }, [forecast])

  const splitIdx = chartData.findIndex(d => d.forecast !== undefined)
  const splitDate = chartData[splitIdx]?.date

  if (!store || !item) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ fontSize: 48 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>Select a Store & Item</div>
        <div style={{ fontSize: 13 }}>Use the <strong>Cmd+K</strong> search or <strong>ARIA</strong> to pick a store and item</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatChip label="Forecast Total" value={forecast ? forecast.predicted_total.toFixed(0) + ' units' : loading ? '...' : '—'} color="#60a5fa" />
        <StatChip label="Store · Item" value={`S${store} · I${item}`} />
        <StatChip label="Horizon" value={`${horizonDays}d`} />
        <StatChip label="Anchor" value={forecast?.anchor_date?.slice(5) ?? anchorDate?.slice(5) ?? '—'} />
      </div>

      {/* Chart tabs */}
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['forecast', 'decomp'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: tab === t ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: tab === t ? '#60a5fa' : '#94a3b8', cursor: 'pointer',
            }}>
              {t === 'forecast' ? '📈 Forecast' : '🔬 Decomposition'}
            </button>
          ))}
          {loading && <span style={{ fontSize: 11, color: '#64748b', alignSelf: 'center', marginLeft: 8 }}>⟳ Loading...</span>}
          {forecast && (
            <a
              href={`http://localhost:8000/export/forecast?store=${store}&item=${item}&horizon_days=${horizonDays}`}
              download style={{
                marginLeft: 'auto', fontSize: 11, color: '#60a5fa',
                padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(96,165,250,0.3)',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ⬇ CSV Export
            </a>
          )}
        </div>

        <div style={{ height: 340, background: 'rgba(255,255,255,0.015)', borderRadius: 12, padding: '8px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
          {tab === 'forecast' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {splitDate && <ReferenceLine x={splitDate} stroke="rgba(96,165,250,0.3)" strokeDasharray="4 2" label={{ value: 'forecast →', fill: '#60a5fa', fontSize: 10 }} />}
                {showConfidence && <Area type="monotone" dataKey="upper" fill="url(#confGrad)" stroke="rgba(96,165,250,0.3)" strokeWidth={1} dot={false} name="Upper CI" legendType="none" />}
                {showConfidence && <Line type="monotone" dataKey="lower" stroke="rgba(96,165,250,0.3)" strokeWidth={1} dot={false} name="Lower CI" strokeDasharray="3 2" />}
                <Line type="monotone" dataKey="actual" stroke="#94a3b8" strokeWidth={2} dot={false} name="Actual" />
                <Line type="monotone" dataKey="forecast" stroke="#60a5fa" strokeWidth={2.5} dot={false} name="Forecast" strokeDasharray="none" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast?.decomposition?.map(d => ({ ...d, date: d.date.slice(5) })) ?? []} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="trend" stroke="#22c55e" strokeWidth={2} dot={false} name="Trend" />
                <Line type="monotone" dataKey="seasonal" stroke="#f59e0b" strokeWidth={2} dot={false} name="Seasonal" />
                <Line type="monotone" dataKey="residual" stroke="#a78bfa" strokeWidth={2} dot={false} name="Residual" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}

      {/* Info chips */}
      {forecast && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'forecast_aggregation', label: `Aggregation: ${aggregation}` },
            { key: 'forecast_normalization', label: `Normalize: ${normalize ? 'On' : 'Off'}` },
            { key: 'confidence_band_pct', label: 'Confidence band' },
            { key: 'forecast_decomposition', label: 'Decomposition' },
          ].map(c => (
            <button key={c.key} onClick={() => { setSelectedKey(c.key); setDrawerOpen(true) }}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748b', cursor: 'pointer',
              }}>
              {c.label} ↗
            </button>
          ))}
        </div>
      )}

      <ExplanationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        explanation={selectedKey && forecast ? forecast.explanations[selectedKey] ?? null : null}
        metricKey={selectedKey ?? undefined}
      />
    </div>
  )
}
