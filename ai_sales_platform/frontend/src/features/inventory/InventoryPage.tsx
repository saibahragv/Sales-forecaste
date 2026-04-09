import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { Panel } from '../../shared/Panel'

type InventoryItem = {
  store: number
  item: number
  anchor_date: string
  lead_time_days: number
  service_level: number
  avg_daily_actual_30d: number
  avg_daily_forecast_30d: number
  std_daily_30d: number
  cv_30d: number
  safety_stock: number
  reorder_point: number
  forecast_30d_total: number
  stockout_risk_score: number
  stockout_risk_band: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  days_to_reorder: number
  abc_class: string
  xyz_class: string
  class_combined: string
  recommendation: string
}

type Alert = { store: number; item: number; risk_band: string; days_to_reorder: number; recommendation: string; abc_xyz: string }

const RISK_COLORS: Record<string, string> = {
  CRITICAL: 'var(--risk-high)',
  HIGH: 'hsl(30,90%,60%)',
  MEDIUM: 'var(--risk-med)',
  LOW: 'var(--risk-low)',
}

const RISK_BG: Record<string, string> = {
  CRITICAL: 'rgba(220,50,50,0.12)',
  HIGH: 'rgba(245,158,11,0.12)',
  MEDIUM: 'rgba(234,179,8,0.08)',
  LOW: 'rgba(34,197,94,0.08)',
}

function RiskBadge({ band }: { band: string }) {
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
      color: RISK_COLORS[band] || 'var(--fg-muted)',
      background: RISK_BG[band] || 'transparent',
      border: `1px solid ${RISK_COLORS[band] || 'var(--border-light)'}`,
    }}>
      {band}
    </span>
  )
}

function ClassBadge({ cls }: { cls: string }) {
  const a = cls[0], x = cls[1] || ''
  const colorA = a === 'A' ? '#3b82f6' : a === 'B' ? '#8b5cf6' : '#6b7280'
  const colorX = x === 'X' ? '#10b981' : x === 'Y' ? '#f59e0b' : '#ef4444'
  return (
    <span className="flex gap-0.5 font-mono text-xs font-bold">
      <span style={{ color: colorA }}>{a}</span>
      <span style={{ color: colorX }}>{x}</span>
    </span>
  )
}

function MetricRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border-light last:border-0">
      <span className="text-xs text-fg-muted">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        {sub && <span className="text-xs text-fg-muted ml-1">{sub}</span>}
      </div>
    </div>
  )
}

export function InventoryPage() {
  const { store, item } = useFiltersStore()
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [leadTime, setLeadTime] = useState(7)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAlertsLoading(true)
    api.get<{ alerts: Alert[] }>('/inventory/alerts?top_n=10')
      .then(r => setAlerts(r.data.alerts))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false))
  }, [])

  useEffect(() => {
    if (!store || !item) { setDetail(null); return }
    setLoading(true)
    setError(null)
    api.get<InventoryItem>(`/inventory?store=${store}&item=${item}&lead_time_days=${leadTime}`)
      .then(r => setDetail(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [store, item, leadTime])

  const criticalCount = alerts.filter(a => a.risk_band === 'CRITICAL').length
  const highCount = alerts.filter(a => a.risk_band === 'HIGH').length

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold glow-text">Inventory Intelligence</h2>
          <p className="text-sm text-fg-muted">Safety stock, reorder points, ABC-XYZ classification</p>
        </div>
        <div className="flex gap-3 text-sm">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full risk-flag-high bg-red-900/20">
              <span className="text-risk-high font-bold">{criticalCount}</span>
              <span className="text-risk-high">Critical</span>
            </div>
          )}
          {highCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/20">
              <span className="text-risk-med font-bold">{highCount}</span>
              <span className="text-risk-med">High Risk</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Alerts Panel */}
        <div className="col-span-7">
          <Panel title="🚨 Stock-Out Risk Alerts — Top 10">
            {alertsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-sm text-fg-muted py-4 text-center">No risk alerts found</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl border"
                    style={{
                      background: RISK_BG[a.risk_band] || 'var(--bg-surface)',
                      borderColor: RISK_COLORS[a.risk_band] || 'var(--border-light)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-semibold">Store {a.store} · Item {a.item}</div>
                        <div className="text-xs text-fg-muted">{a.recommendation}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RiskBadge band={a.risk_band} />
                      <div className="flex items-center gap-2">
                        <ClassBadge cls={a.abc_xyz} />
                        <span className="text-xs text-fg-muted">
                          {a.days_to_reorder === 0 ? '⚠️ NOW' : `Reorder in ${a.days_to_reorder}d`}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Detail Panel */}
        <div className="col-span-5">
          <Panel title={store && item ? `Store ${store} · Item ${item} — Detail` : 'Select Item for Detail'}>
            {!store || !item ? (
              <div className="text-sm text-fg-muted py-8 text-center flex flex-col items-center gap-2">
                <div className="text-3xl">📦</div>
                <div>Select a Store and Item above to see detailed inventory metrics</div>
              </div>
            ) : error ? (
              <div className="text-sm text-risk-high py-4">{error}</div>
            ) : loading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-8 rounded" />)}
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <RiskBadge band={detail.stockout_risk_band} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-muted">ABC-XYZ:</span>
                    <ClassBadge cls={detail.class_combined} />
                  </div>
                </div>

                <div className="glass-panel p-3 text-xs leading-relaxed" style={{
                  borderLeftColor: RISK_COLORS[detail.stockout_risk_band],
                  borderLeftWidth: 3,
                }}>
                  {detail.recommendation}
                </div>

                <div>
                  <div className="text-xs text-fg-muted uppercase tracking-wider mb-2">Supply Metrics</div>
                  <MetricRow label="Safety Stock" value={detail.safety_stock.toFixed(0)} sub="units" />
                  <MetricRow label="Reorder Point" value={detail.reorder_point.toFixed(0)} sub="units" />
                  <MetricRow label="Days to Reorder" value={detail.days_to_reorder === 0 ? '⚠️ NOW' : `${detail.days_to_reorder}d`} />
                  <MetricRow label="Lead Time" value={`${detail.lead_time_days}d`} />
                </div>

                <div>
                  <div className="text-xs text-fg-muted uppercase tracking-wider mb-2">Demand Metrics</div>
                  <MetricRow label="Avg Daily (30d actual)" value={detail.avg_daily_actual_30d.toFixed(1)} sub="units/day" />
                  <MetricRow label="Avg Daily (forecast)" value={detail.avg_daily_forecast_30d.toFixed(1)} sub="units/day" />
                  <MetricRow label="Forecast 30d Total" value={detail.forecast_30d_total.toFixed(0)} sub="units" />
                  <MetricRow label="Volatility (CV)" value={detail.cv_30d.toFixed(3)} />
                  <MetricRow label="Std Dev (30d)" value={detail.std_daily_30d.toFixed(1)} sub="units/day" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-muted">Lead Time:</span>
                  <input
                    type="range" min={1} max={30} step={1}
                    value={leadTime}
                    onChange={e => setLeadTime(parseInt(e.target.value))}
                    className="flex-1 h-1"
                  />
                  <span className="text-xs text-fg-primary w-8 text-right">{leadTime}d</span>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  )
}

