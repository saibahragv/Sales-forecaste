import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useMemo } from 'react'

export function ExportModal(props: {
  open: boolean
  onClose: () => void
  title: string
  payload: unknown
  filename: string
}) {
  const json = useMemo(() => {
    try {
      return JSON.stringify(props.payload, null, 2)
    } catch {
      return '{"error":"Failed to serialize payload"}'
    }
  }, [props.payload])

  const copy = async () => {
    await navigator.clipboard.writeText(json)
  }

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-3xl rounded-xl border border-border-subtle bg-surface-1 shadow-surface text-app-fg">
          <div className="flex items-start justify-between border-b border-border-subtle px-4 py-3">
            <div>
              <DialogTitle as="div" className="text-sm font-medium text-app-fg">
                {props.title}
              </DialogTitle>
              <div className="mt-1 text-xs text-app-muted">Export is deterministic and includes current filters/scope.</div>
            </div>
            <button className="rounded-md px-2 py-1 text-xs text-app-muted hover:bg-surface-2" onClick={props.onClose}>
              Close
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <button
                className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:opacity-95"
                onClick={download}
              >
                Download JSON
              </button>
              <button
                className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-medium text-app-fg hover:bg-surface-3"
                onClick={copy}
              >
                Copy JSON
              </button>
            </div>

            <textarea
              className="h-80 w-full rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-app-fg"
              value={json}
              readOnly
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
