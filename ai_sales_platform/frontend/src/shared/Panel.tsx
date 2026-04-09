import { ReactNode } from 'react'
import clsx from 'clsx'

export function Panel(props: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        'rounded-xl border border-border-subtle bg-surface-1 shadow-surface',
        'text-app-fg',
        props.className,
      )}
    >
      {(props.title || props.right) && (
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="text-sm font-medium text-app-fg">{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      <div className="p-4">{props.children}</div>
    </section>
  )
}
