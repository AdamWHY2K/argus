import { useId } from 'react'

/** The eye's silhouette. Bars are clipped to it, so the contour only closes the shape. */
const EYE =
  'M2 16C2 16 10 4.5 24 4.5C38 4.5 46 16 46 16C46 16 38 27.5 24 27.5C10 27.5 2 16 2 16Z'
const EYE_SMALL = 'M3 16C3 16 10 6 24 6C38 6 45 16 45 16C45 16 38 26 24 26C10 26 3 16 3 16Z'

/**
 * The argus mark: the vigil strip clipped inside an eye.
 *
 * Bars are derived from the centre outward — the middle bar is centred on the
 * mark and the rest sit at ±7 and ±14 — so the pupil never drifts off axis.
 * The contour is a hairline on purpose: at a heavier weight it becomes the
 * loudest thing in the mark and the rhythm reads as filler inside a border.
 */
export function Mark({
  className = '',
  compact = false,
}: {
  className?: string
  /** Three bars instead of five. Below ~24px the five-bar rhythm turns to mush. */
  compact?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const clip = `argus-eye-${id}`

  return (
    <svg
      viewBox="0 0 48 32"
      className={`w-auto ${className}`}
      fill="none"
      role="img"
      aria-label="argus"
    >
      <defs>
        <clipPath id={clip}>
          <path d={compact ? EYE_SMALL : EYE} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        {compact ? (
          <>
            <rect x="10" y="0" width="6" height="32" fill="var(--color-faint)" opacity="0.7" />
            <rect x="21" y="0" width="6" height="32" fill="var(--color-change)" />
            <rect x="32" y="0" width="6" height="32" fill="var(--color-faint)" opacity="0.7" />
          </>
        ) : (
          <>
            <rect x="7.7" y="0" width="4.6" height="32" fill="var(--color-faint)" opacity="0.5" />
            <rect x="14.7" y="0" width="4.6" height="32" fill="var(--color-faint)" opacity="0.75" />
            <rect x="21.7" y="0" width="4.6" height="32" fill="var(--color-change)" />
            <rect x="28.7" y="0" width="4.6" height="32" fill="var(--color-faint)" opacity="0.75" />
            <rect x="35.7" y="0" width="4.6" height="32" fill="var(--color-faint)" opacity="0.5" />
          </>
        )}
      </g>

      <path
        d={compact ? EYE_SMALL : EYE}
        stroke="currentColor"
        strokeWidth={compact ? 3.4 : 1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark plus wordmark, for headers. */
export function Lockup({ className = '', markClass = 'h-5' }: { className?: string; markClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className={`${markClass} text-ink`} />
      <span className="font-display text-ink text-[17px] leading-none font-bold tracking-[-0.02em]">
        argus
      </span>
    </span>
  )
}
