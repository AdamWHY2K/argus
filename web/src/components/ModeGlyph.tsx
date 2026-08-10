import type { WatchMode } from '../api'

const PATHS: Record<WatchMode, React.ReactNode> = {
  text: (
    <g>
      <rect x="3" y="5" width="26" height="2.5" rx="1.25" />
      <rect x="3" y="11" width="20" height="2.5" rx="1.25" />
      <rect x="3" y="17" width="24" height="2.5" rx="1.25" />
      <rect x="3" y="23" width="14" height="2.5" rx="1.25" />
    </g>
  ),
  element: (
    <g>
      <rect x="3" y="5" width="26" height="2.5" rx="1.25" opacity="0.3" />
      <rect x="2" y="11" width="28" height="9" rx="2" fill="none" strokeWidth="2" stroke="currentColor" />
      <rect x="5" y="14.5" width="16" height="2" rx="1" />
      <rect x="3" y="23" width="14" height="2.5" rx="1.25" opacity="0.3" />
    </g>
  ),
  visual: (
    <g>
      <rect x="2" y="4" width="28" height="23" rx="2" fill="none" strokeWidth="2" stroke="currentColor" />
      <circle cx="10" cy="12" r="2.6" />
      <path d="M5 24l7-8 5 5 4-3 5 6z" />
    </g>
  ),
}

export const MODE_LABEL: Record<WatchMode, string> = {
  text: 'Text',
  element: 'Element',
  visual: 'Visual',
}

export const MODE_BLURB: Record<WatchMode, string> = {
  text: 'The words on the page. Ignores layout and styling.',
  element: 'One part of the page, chosen with a CSS selector.',
  visual: 'How the page looks, compared pixel by pixel.',
}

/** One glyph vocabulary, used on the board, the add page and the settings rail. */
export function ModeGlyph({ mode, className = '' }: { mode: WatchMode; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      {PATHS[mode]}
    </svg>
  )
}
