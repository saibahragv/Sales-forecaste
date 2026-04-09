import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { Panel } from '../../shared/Panel'
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

export function ExplainabilityPage() {
  const { store, item } = useFiltersStore()
  const [globalResp, setGlobalResp] = useState<ShapGlobalResponse | null>(null)
  const [localResp, setLocalResp] = useState<ShapLocalResponse | null>(null)
  const [targetDate, setTargetDate] = useState('2017-12-31')
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

  const fetchLocal = async () => {
    if (store === undefined || item === undefined) return
    const r = await api.get<ShapLocalResponse>('/shap/local', { params: { store, item, target_date: targetDate } })
    setLocalResp(r.data)
  }

  const barData = useMemo(() => {
    const top = globalResp?.top_features ?? []
    return [...top].reverse()
  }, [globalResp])

  return (
    <div className="space-y-6">
      <Panel title="Global Feature Importance" right={<div className="text-xs text-slate-400">{globalResp?.status ?? '—'}</div>}>
        {globalResp?.status === 'computing' && (
          <div className="text-sm text-slate-300">Computing SHAP importance in background. Refresh in a moment.</div>
        )}
        {globalResp?.status === 'failed' && <div className="text-sm text-rose-300">SHAP computation failed. Try again later.</div>}
        {globalErr && <div className="mt-2 text-xs text-rose-300">{globalErr}</div>}
        <div className="h-[360px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 30, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis type="category" dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 12 }} width={110} />
              <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1f2937' }} />
              <Bar dataKey="mean_abs_shap" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Local Explanation">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-400">Target date</div>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="flex items-end">
            <button
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
              onClick={fetchLocal}
              disabled={store === undefined || item === undefined}
            >
              Explain
            </button>
          </div>
        </div>

        {localResp && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-200">Prediction: {localResp.prediction.toFixed(2)}</div>
            <div className="text-sm text-slate-300">{localResp.summary}</div>
          </div>
        )}
      </Panel>
    </div>
  )
}
