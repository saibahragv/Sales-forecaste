export function Skeleton(props: { className?: string }) {
  return <div className={props.className ?? 'h-4 w-full animate-pulse rounded bg-slate-800/60'} />
}
