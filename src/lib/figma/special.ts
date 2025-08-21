export type VisibilityAction = 'show' | 'hide'

export function stripSpecialPrefix(input: string): string {
  const s = String(input || '').trim()
  return s.startsWith('/') ? s.slice(1).trim() : s
}

export function getVisibilityAction(raw: string, requiresSlash: boolean): VisibilityAction | null {
  const s = String(raw || '').trim()
  const val = requiresSlash ? stripSpecialPrefix(s) : s
  const lower = val.toLowerCase()
  if (lower === 'show') return 'show'
  if (lower === 'hide') return 'hide'
  return null
}

export function isSpecialPrefixed(raw: string): boolean {
  return String(raw || '').trim().startsWith('/')
}


