export function parseSolidPaintFromColor(input: string): SolidPaint | null {
  const s = String(input).trim()
  const m = s.match(/^#([0-9a-f]{1,8})$/i)
  if (!m) return null
  const hex = m[1]
  function hexTo01(hh: string): number { return parseInt(hh, 16) / 255 }
  let r = 0, g = 0, b = 0, a = 1
  if (hex.length === 1) { const c = hex[0]; r = hexTo01(c + c); g = hexTo01(c + c); b = hexTo01(c + c) }
  else if (hex.length === 2) { const c1 = hex[0], c2 = hex[1]; r = hexTo01(c1 + c2); g = hexTo01(c1 + c2); b = hexTo01(c1 + c2) }
  else if (hex.length === 3) { r = hexTo01(hex[0] + hex[0]); g = hexTo01(hex[1] + hex[1]); b = hexTo01(hex[2] + hex[2]) }
  else if (hex.length === 6) { r = hexTo01(hex.slice(0,2)); g = hexTo01(hex.slice(2,4)); b = hexTo01(hex.slice(4,6)) }
  else if (hex.length === 8) { r = hexTo01(hex.slice(0,2)); g = hexTo01(hex.slice(2,4)); b = hexTo01(hex.slice(4,6)); a = hexTo01(hex.slice(6,8)) }
  else return null
  const paint: SolidPaint = { type: 'SOLID', color: { r, g, b }, opacity: a }
  return paint
}


