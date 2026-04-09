import { useMemo, useState } from 'react'
import { api } from '../../core/api'
import { useFiltersStore } from '../../store/filters'
import { GlobalFilters } from '../../shared/GlobalFilters'
import { Panel } from '../../shared/Panel'

type AssistantResponse = {
  intent: string
  answer: string
  bullets: string[]
  actions: string[]
  citations: { source_id: string; title: string; score: number }[]
  debug: Record<string, any>
}

export function AIAssistantPage() {
  const { store, item, horizonDays, anchorDate } = useFiltersStore()
  const [query, setQuery] = useState('Explain volatility and stability for this series.')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resp, setResp] = useState<AssistantResponse | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.post<AssistantResponse>('/assistant', {
        query,
        store,
        item,
        horizon_days: horizonDays,
        anchor_date: anchorDate,
      })
      setResp(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Assistant failed')
    } finally {
      setLoading(false)
    }
  }

  const topCitations = useMemo(() => {
    return [...(resp?.citations ?? [])].sort((a, b) => b.score - a.score)
  }, [resp])

  return (
    <div className="space-y-6">
      <GlobalFilters />

      <Panel
        title="AI Assistant (Deterministic)"
        right={loading ? <div className="text-xs text-slate-400">Searching…</div> : null}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="md:col-span-5">
            <div className="text-xs text-slate-400">Query</div>
            <textarea
              className="mt-1 h-24 w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-2 text-[11px] text-slate-500">
              Responses are grounded in a curated analytics knowledge base and computed metrics; no generative text.
            </div>
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
              onClick={run}
              disabled={loading || !query.trim()}
            >
              Ask
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Structured Response">
          {!resp ? (
            <div className="text-sm text-slate-400">Run a query to get a structured answer.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">Intent</div>
              <div className="text-sm text-slate-200">{resp.intent}</div>
              <div className="text-xs text-slate-400">Answer</div>
              <div className="text-sm text-slate-200">{resp.answer}</div>

              {resp.bullets.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400">Key points</div>
                  <div className="mt-2 space-y-1">
                    {resp.bullets.map((b) => (
                      <div key={b} className="text-sm text-slate-200">
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resp.actions.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400">Recommended actions</div>
                  <div className="mt-2 space-y-1">
                    {resp.actions.map((a) => (
                      <div key={a} className="text-sm text-slate-200">
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Citations (Semantic Search)">
          {!resp ? (
            <div className="text-sm text-slate-400">Citations will appear after a query.</div>
          ) : (
            <div className="space-y-2">
              {topCitations.map((c) => (
                <div key={c.source_id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="text-sm text-slate-200">{c.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{c.source_id} · score {c.score.toFixed(3)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Debug">
        <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
          {JSON.stringify(resp?.debug ?? {}, null, 2)}
        </pre>
      </Panel>
    </div>
  )
}
