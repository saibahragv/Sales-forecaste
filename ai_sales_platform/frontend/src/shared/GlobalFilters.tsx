import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFiltersStore } from '../store/filters'
import { Panel } from './Panel'

export function GlobalFilters(props: { compact?: boolean }) {
  const {
    store,
    item,
    horizonDays,
    anchorDate,
    aggregation,
    normalize,
    showConfidence,
    hierarchy,
    hierarchyLoading: loading,
    hierarchyError: error,
    loadHierarchy,
    setStore,
    setItem,
    setHorizonDays,
    setAnchorDate,
    setAggregation,
    setNormalize,
    setShowConfidence,
  } = useFiltersStore()
  const dateRef = useRef<HTMLInputElement | null>(null)

  const openDatePicker = useCallback(() => {
    const el = dateRef.current as any
    if (!el) return
    if (el.disabled) return
    if (el.readOnly) return
    el?.showPicker?.()
  }, [])

  useEffect(() => {
    if (!hierarchy && !loading && !error) {
      loadHierarchy().catch(() => undefined)
    }
  }, [error, hierarchy, loadHierarchy, loading])

  const items = useMemo(() => {
    if (!hierarchy || store === undefined) return []
    return hierarchy.items_by_store[String(store)] ?? []
  }, [hierarchy, store])

  useEffect(() => {
    if (!items.length) return
    if (item === undefined || !items.includes(item)) setItem(items[0])
  }, [item, items, setItem])

  const minDate = hierarchy?.min_date
  const maxDate = hierarchy?.max_date

  return (
    <Panel
      title={props.compact ? undefined : 'Global Filters'}
      right={
        error ? (
          <button
            className="rounded-md border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-app-fg hover:bg-surface-3"
            onClick={() => loadHierarchy({ force: true }).catch(() => undefined)}
            disabled={loading}
          >
            Retry
          </button>
        ) : loading ? (
          <div className="text-xs text-app-muted">Loading…</div>
        ) : null
      }
    >
      <div className={props.compact ? 'grid grid-cols-1 gap-3 md:grid-cols-6' : 'grid grid-cols-1 gap-4 md:grid-cols-6'}>
        <div>
          <div className="text-xs text-app-muted">Store</div>
          <select
            className="mt-1 w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-app-fg"
            value={store ?? ''}
            onChange={(e) => setStore(e.target.value ? Number(e.target.value) : undefined)}
            disabled={loading || !hierarchy}
          >
            <option value="" disabled>
              {loading ? 'Loading…' : 'Select store'}
            </option>
            {(hierarchy?.stores ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-app-muted">Item</div>
          <select
            className="mt-1 w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-app-fg"
            value={item ?? ''}
            onChange={(e) => setItem(e.target.value ? Number(e.target.value) : undefined)}
            disabled={loading || !hierarchy || store === undefined}
          >
            <option value="" disabled>
              {loading ? 'Loading…' : store === undefined ? 'Select store first' : 'Select item'}
            </option>
            {items.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-app-muted">Anchor date</div>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-app-fg"
            value={anchorDate ?? ''}
            onChange={(e) => setAnchorDate(e.target.value || undefined)}
            min={minDate}
            max={maxDate}
            ref={dateRef}
            onClick={openDatePicker}
            onKeyDown={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            disabled={loading || !hierarchy}
          />
          <div className="mt-1 text-[11px] text-app-subtle">Range: {minDate ?? '—'} → {maxDate ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-app-muted">Aggregation</div>
          <select
            className="mt-1 w-full rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-app-fg"
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as any)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <div className="text-xs text-app-muted">Horizon</div>
          <input
            type="range"
            min={7}
            max={90}
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-1 text-xs text-app-muted">{horizonDays} days</div>
        </div>

        <div>
          <div className="text-xs text-app-muted">Toggles</div>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-app-fg">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
              Normalize
            </label>
            <label className="flex items-center gap-2 text-xs text-app-fg">
              <input type="checkbox" checked={showConfidence} onChange={(e) => setShowConfidence(e.target.checked)} />
              Confidence band
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-900/40 bg-rose-950/20 p-3">
          <div className="text-xs font-medium text-rose-300">Filters unavailable</div>
          <div className="mt-1 text-xs text-rose-300/90">{error}</div>
          <div className="mt-2 text-[11px] text-rose-200/80">
            Check that the backend is running and reachable at <span className="font-mono">http://localhost:8000</span>.
            You should be able to open <span className="font-mono">/docs</span> in your browser.
          </div>
        </div>
      )}
    </Panel>
  )
}
