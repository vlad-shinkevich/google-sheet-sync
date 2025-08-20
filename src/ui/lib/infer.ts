export type FieldKind = 'text' | 'image' | 'link' | 'color' | 'variant'

export function inferFieldType(value: string): FieldKind {
  const v = String(value || '').trim()
  if (!v) return 'text'
  if (/^#([0-9a-f]{1,8})$/i.test(v)) return 'color'
  if (/=/.test(v)) return 'variant'
  try {
    const u = new URL(v)
    const host = u.host.toLowerCase()
    const pathname = u.pathname.toLowerCase()
    const isImageExt = /\.(png|jpe?g|gif|webp|svg)$/i.test(pathname)
    const isGDrive = host.endsWith('googleusercontent.com') || host.includes('drive.google.com')
    if (isImageExt || isGDrive) return 'image'
    return 'link'
  } catch {
    return 'text'
  }
}


