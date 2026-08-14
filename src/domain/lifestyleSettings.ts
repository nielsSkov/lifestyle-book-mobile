export const DEFAULT_RECORD_SUBTITLE = 'Everyday log'

export function recordSubtitle(name?: string): string {
  if (!name) return DEFAULT_RECORD_SUBTITLE

  const possessive = name.toLowerCase().endsWith('s') ? `${name}'` : `${name}'s`
  return `${possessive} log`
}
