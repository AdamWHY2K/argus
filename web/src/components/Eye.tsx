/** The argus mark — a single open eye, drawn once and reused at every size. */
export function Eye({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" fill="none" className={className} aria-hidden="true">
      <ellipse cx="16" cy="11" rx="14.5" ry="9.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="11" r="4.4" fill="currentColor" />
    </svg>
  )
}
