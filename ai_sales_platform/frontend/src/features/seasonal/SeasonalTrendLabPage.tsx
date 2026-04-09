import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { Panel } from '../../shared/Panel'
import { Skeleton } from '../../shared/Skeleton'
import { ExportModal } from '../../shared/ExportModal'

type FeaturesResponse = {
  scope: string
  snapshot: { feature: string; value: number }[]
}

export function SeasonalTrendLabPage() {
  const { store, item, anchorDate } = useFiltersStore()
  const [resp, setResp] = useState<FeaturesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [weekdayMode, setWeekdayMode] = useState<'sales' | 'momentum' | 'volatility'>('sales')
  const [amplitudeWindowDays, setAmplitudeWindowDays] = useState<30 | 90>(30)
  const [normalization, setNormalization] = useState<'none' | 'z' | 'minmax'>('none')
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get<FeaturesResponse>('/features', { params: { store, item, anchor_date: anchorDate } })
      .then((r) => setResp(r.data))
      .finally(() => setLoading(false))
  }, [store, item, anchorDate])

  const snap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of resp?.snapshot ?? []) m[s.feature] = s.value
    return m
  }, [resp])

  const exportPayload = useMemo(() => {
    return {
      page: 'seasonal_trend_lab',
      filters: {
        store,
        item,
        anchor_date: anchorDate,
      },
      configuration: {
        weekday_heatmap_mode: weekdayMode,
        monthly_amplitude_window_days: amplitudeWindowDays,
        normalization,
      },
      snapshot: resp?.snapshot ?? [],
    }
  }, [amplitudeWindowDays, anchorDate, item, normalization, resp?.snapshot, store, weekdayMode])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Seasonality Strength Index" right={loading ? <div className="text-xs text-slate-400">Loading…</div> : null}>
          {!resp && loading ? (
            <Skeleton className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-200">30d amplitude: {(snap['seasonal_amp_30'] ?? 0).toFixed(2)}</div>
              <div className="text-sm text-slate-200">90d amplitude: {(snap['seasonal_amp_90'] ?? 0).toFixed(2)}</div>
              <div className="text-xs text-slate-500">Amplitude proxies are derived from rolling max-min windows.</div>
            </div>
          )}
        </Panel>

        <Panel title="Trend Slope Coefficient">
          {!resp && loading ? (
            <Skeleton className="h-20 w-full animate-pulse rounded bg-slate-800/60" />
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-200">Slope 14: {(snap['slope_14'] ?? 0).toFixed(4)}</div>
              <div className="text-sm text-slate-200">Slope 30: {(snap['slope_30'] ?? 0).toFixed(4)}</div>
              <div className="text-sm text-slate-200">Slope 60: {(snap['slope_60'] ?? 0).toFixed(4)}</div>
            </div>
          )}
        </Panel>

        <Panel title="Cycle Detection (Proxy)">
          <div className="space-y-2">
            <div className="text-sm text-slate-200">Week-of-year encodings: woy_sin / woy_cos</div>
            <div className="text-sm text-slate-200">Month encodings: month_sin / month_cos</div>
            <div className="text-xs text-slate-500">Cycle detection UI is backed by cyclical encodings and amplitude metrics.</div>
          </div>
        </Panel>
      </div>

      <Panel title="Weekday & Monthly Intensity (Configuration)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-400">Weekday heatmap mode</div>
            <select
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={weekdayMode}
              onChange={(e) => setWeekdayMode(e.target.value as any)}
            >
              <option value="sales">Sales</option>
              <option value="momentum">Momentum</option>
              <option value="volatility">Volatility</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400">Monthly amplitude view</div>
            <select
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={String(amplitudeWindowDays)}
              onChange={(e) => setAmplitudeWindowDays((Number(e.target.value) as any) || 30)}
            >
              <option value="30">30-day</option>
              <option value="90">90-day</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400">Normalization</div>
            <select
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={normalization}
              onChange={(e) => setNormalization(e.target.value as any)}
            >
              <option value="none">None</option>
              <option value="z">Z-score</option>
              <option value="minmax">Min-Max</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400">Export view</div>
            <button
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
              onClick={() => setExportOpen(true)}
            >
              Export configuration
            </button>
          </div>
        </div>
      </Panel>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Seasonal & Trend Lab — Export"
        payload={exportPayload}
        filename="seasonal-trend-config.json"
      />
    </div>
  )
}
