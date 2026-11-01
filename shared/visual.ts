export const VISUAL_MODES = ['overlay', 'swipe', 'side', 'after'] as const

export type VisualMode = (typeof VISUAL_MODES)[number]

export function isVisualMode(value: unknown): value is VisualMode {
  return typeof value === 'string' && (VISUAL_MODES as readonly string[]).includes(value)
}
