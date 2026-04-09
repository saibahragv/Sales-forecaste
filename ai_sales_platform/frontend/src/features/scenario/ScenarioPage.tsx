import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, Area
} from 'recharts'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'

type ScenarioAdjustment = {
  price_elasticity: number
  promotion_intensity: number
  macro_demand_shock_pct: number
  growth_slope: number
  marketing_spend: number
  competitive_pressure: number
  weather_impact: number
}

type ScenarioPoint = {
  date: string
  baseline: number
  scenario: number
  delta: number
  delta_pct: number | null
}

type ScenarioResult = {
  baseline_total: number
  scenario_total: number
  delta_total: number
  delta_total_pct: number | null
  series: ScenarioPoint[]
}

const DEFAULT_ADJ: ScenarioAdjustment = {
  price_elasticity: 0,
  promotion_intensity: 0,
  macro_demand_shock_pct: 0,
  growth_slope: 0,
  marketing_spend: 0,
  competitive_pressure: 0,
  weather_impact: 0,
}

const SLIDER_CONFIG: { key: keyof ScenarioAdjustment; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'macro_demand_shock_pct', label: 'Macro Demand Shock', min: -50, max: 100, step: 1, unit: '%' },
  { key: 'promotion_intensity', label: 'Promotion Intensity', min: 0, max: 1, step: 0.01, unit: '' },
  { key: 'marketing_spend', label: 'Marketing Spend', min: 0, max: 1, step: 0.01, unit: '' },
  { key: 'price_elasticity', label: 'Price Elasticity', min: -2, max: 2, step: 0.1, unit: '' },
  { key: 'growth_slope', label: 'Growth Slope', min: -0.5, max: 0.5, step: 0.01, unit: '' },
  { key: 'competitive_pressure', label: 'Competitive Pressure', min: 0, max: 1, step: 0.01, unit: '' },
  { key: 'weather_impact', label: 'Weather Impact', min: -1, max: 1, step: 0.05, unit: '' },
]

const SCENARIO_COLORS = ['#3b82f6', '#10b981', '#f59e0b']
const SCENARIO_NAMES = ['Zero Adjustments', 'Aggressive Promo', 'Recession Shock']

export function ScenarioPage() {
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  const [scenarios, setScenarios] = useState<ScenarioAdjustment[]>([
    { ...DEFAULT_ADJ },
    { ...DEFAULT_ADJ, promotion_intensity: 0.3 },
    { ...DEFAULT_ADJ, macro_demand_shock_pct: -15 },
  ])
  const [activeTab, setActiveTab] = useState(0)
  const [results, setResults] = useState<(ScenarioResult | null)[]>([null, null, null])
  const [loading, setLoading] = useState<boolean[]>([false, false, false])
  const [error, setError] = useState<string | null>(null)

  const runScenario = useCallback(async (idx: number) => {
    if (!store || !item) {
      setError('Select a Store and Item from the filter bar to run simulations.')
      return
    }
    setError(null)
    setLoading(prev => { const n = [...prev]; n[idx] = true; return n })
    try {
      const resp = await api.post<ScenarioResult>('/scenario', {
        store, item,
        horizon_days: horizonDays,
        anchor_date: anchorDate || undefined,
        adjustments: scenarios[idx],
      })
      setResults(prev => { const n = [...prev]; n[idx] = resp.data; return n })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Scenario failed'
      setError(msg)
    } finally {
      setLoading(prev => { const n = [...prev]; n[idx] = false; return n })
    }
  }, [store, item, horizonDays, anchorDate, scenarios])

  // Auto-run active scenario on slider change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => runScenario(activeTab), 400)
    return () => clearTimeout(timer)
  }, [scenarios[activeTab], activeTab, store, item, horizonDays, anchorDate])

  const handleSlider = (key: keyof ScenarioAdjustment, value: number) => {
    setScenarios(prev => {
      const n = [...prev]
      n[activeTab] = { ...n[activeTab], [key]: value }
      return n
    })
  }

  // Merge all non-null results into chart data
  const chartData = (() => {
    const primary = results.find(r => r !== null)
    if (!primary) return []
    return primary.series.map((pt, i) => {
      const row: Record<string, unknown> = {
        date: pt.date.slice(5), // MM-DD
        baseline: Math.round(pt.baseline * 10) / 10,
      }
      results.forEach((r, ri) => {
        if (r) row[`s${ri}`] = Math.round(r.series[i]?.scenario * 10) / 10
      })
      return row
    })
  })()

  const activeResult = results[activeTab]
  const deltaPositive = (activeResult?.delta_total ?? 0) >= 0

  return (
    <div className="space-y-4">
      <GlobalFilters />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold glow-text">Scenario Matrix Lab</h2>
          <p className="text-sm text-fg-muted">Real-time what-if simulation powered by LightGBM</p>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => { setActiveTab(i); runScenario(i) }}
              className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all ${
                activeTab === i
                  ? 'border-accent-base text-white shadow-lg'
                  : 'border-border-light text-fg-muted hover:border-accent-base'
              }`}
              style={activeTab === i ? { backgroundColor: SCENARIO_COLORS[i] + '33', borderColor: SCENARIO_COLORS[i] } : {}}
            >
              {SCENARIO_NAMES[i]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass-panel p-3 border-l-4 border-risk-high text-sm text-risk-high animate-pulse">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Sliders Panel */}
        <div className="col-span-3 glass-panel p-4 space-y-4">
          <div className="text-xs text-fg-muted uppercase tracking-widest font-semibold border-b border-border-light pb-2">
            {SCENARIO_NAMES[activeTab]} Controls
          </div>
          {SLIDER_CONFIG.map(cfg => {
            const val = scenarios[activeTab][cfg.key]
            const isZero = val === 0
            return (
              <div key={cfg.key} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={`font-medium ${isZero ? 'text-fg-muted' : 'text-fg-primary'}`}>{cfg.label}</span>
                  <span className={`font-mono tabular-nums ${
                    val > 0 ? 'text-risk-low' : val < 0 ? 'text-risk-high' : 'text-fg-muted'
                  }`}>
                    {val > 0 ? '+' : ''}{cfg.key === 'macro_demand_shock_pct' ? val.toFixed(0) + '%' : val.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={cfg.min} max={cfg.max} step={cfg.step}
                  value={val}
                  onChange={e => handleSlider(cfg.key, parseFloat(e.target.value))}
                  className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${val < 0 ? 'var(--risk-high)' : 'var(--accent-base)'} ${
                      ((val - cfg.min) / (cfg.max - cfg.min)) * 100
                    }%, var(--bg-surface) 0%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-fg-muted opacity-60">
                  <span>{cfg.min}{cfg.unit}</span>
                  <span>{cfg.max}{cfg.unit}</span>
                </div>
              </div>
            )
          })}
          <button
            onClick={() => {
              setScenarios(prev => { const n = [...prev]; n[activeTab] = { ...DEFAULT_ADJ }; return n })
            }}
            className="w-full text-xs text-fg-muted hover:text-white border border-border-light hover:border-accent-base rounded-lg py-1.5 transition-all"
          >
            Reset to Baseline
          </button>
        </div>

        {/* Chart + KPIs */}
        <div className="col-span-9 space-y-4">
          {/* KPI Cards */}
          {activeResult && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Baseline Total', val: activeResult.baseline_total.toFixed(0), sub: 'units', color: 'text-fg-secondary' },
                { label: 'Scenario Total', val: activeResult.scenario_total.toFixed(0), sub: 'units', color: 'text-fg-primary' },
                {
                  label: 'Net Delta',
                  val: (deltaPositive ? '+' : '') + activeResult.delta_total.toFixed(0),
                  sub: 'units',
                  color: deltaPositive ? 'text-risk-low' : 'text-risk-high',
                },
                {
                  label: '% Change',
                  val: activeResult.delta_total_pct != null
                    ? (deltaPositive ? '+' : '') + activeResult.delta_total_pct.toFixed(1) + '%'
                    : '—',
                  sub: 'vs baseline',
                  color: deltaPositive ? 'text-risk-low' : 'text-risk-high',
                },
              ].map(kpi => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel p-3"
                >
                  <div className="text-xs text-fg-muted mb-1">{kpi.label}</div>
                  <div className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.val}</div>
                  <div className="text-xs text-fg-muted">{kpi.sub}</div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Chart */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-fg-secondary">
                Baseline vs Scenarios — {horizonDays}d Horizon
              </div>
              {loading[activeTab] && (
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <div className="w-3 h-3 border border-accent-base border-t-transparent rounded-full animate-spin" />
                  Recalculating...
                </div>
              )}
            </div>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-fg-muted gap-3">
                <div className="text-4xl">🧪</div>
                <div className="text-sm">Select a store and item, then adjust the sliders</div>
                <div className="text-xs opacity-60">The real model will predict the impact instantly</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--fg-muted)', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'var(--fg-muted)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--fg-secondary)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'var(--fg-secondary)' }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Baseline"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  {[0, 1, 2].map(i => results[i] && (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`s${i}`}
                      name={SCENARIO_NAMES[i]}
                      stroke={SCENARIO_COLORS[i]}
                      strokeWidth={i === activeTab ? 2.5 : 1.5}
                      dot={false}
                      opacity={i === activeTab ? 1 : 0.4}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
