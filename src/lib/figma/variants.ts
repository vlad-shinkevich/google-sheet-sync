export function parseVariantAssignments(input: string): Record<string, string> | { __valueOnly: string } {
  const raw = String(input).trim()
  const parts = raw.split(/\s*[|,]\s*/).filter(Boolean)
  const map: Record<string, string> = {}
  let valueOnly: string | null = null
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq > -1) { const k = p.slice(0, eq).trim(); const v = p.slice(eq + 1).trim(); if (k && v) map[k] = v }
    else { if (!valueOnly) valueOnly = p.trim() }
  }
  if (Object.keys(map).length > 0) return map
  if (valueOnly) return { __valueOnly: valueOnly }
  return {}
}

export async function setInstanceVariants(instance: InstanceNode, assignment: Record<string, string> | { __valueOnly: string }) {
  let main: ComponentNode | null = null
  try { main = await instance.getMainComponentAsync() } catch { main = null }
  if (!main) return
  const props = (main as any).variantProperties as Record<string, string> | undefined
  if (!props || Object.keys(props).length === 0) return
  const propsSafe = props as Record<string, string>
  const current = instance.variantProperties || {}
  const next: { [key: string]: string } = { ...current }
  const propNameMapCI = new Map<string, string>()
  const propValuesMapCI = new Map<string, Map<string, string>>()
  for (const propName of Object.keys(propsSafe)) { propNameMapCI.set(propName.toLowerCase(), propName); propValuesMapCI.set(propName, new Map<string, string>()) }
  const parent = (main as any).parent
  if (parent && 'children' in parent) {
    for (const child of parent.children as readonly SceneNode[]) {
      const comp = child as any
      if (comp && comp.type === 'COMPONENT' && comp.variantProperties) {
        const vp = comp.variantProperties as Record<string, string>
        for (const [k, v] of Object.entries(vp)) {
          if (!propNameMapCI.has(k.toLowerCase())) propNameMapCI.set(k.toLowerCase(), k)
          const vm = propValuesMapCI.get(propNameMapCI.get(k.toLowerCase())!) || new Map<string, string>()
          vm.set(String(v).toLowerCase(), String(v))
          propValuesMapCI.set(propNameMapCI.get(k.toLowerCase())!, vm)
        }
      }
    }
  }
  function resolvePropNameCI(input: string): string | null { const exact = propsSafe[input] ? input : null; if (exact) return exact; const lower = input.toLowerCase(); return propNameMapCI.get(lower) || null }
  function resolvePropValueCI(propCanonical: string, input: string): string { const vm = propValuesMapCI.get(propCanonical); if (!vm || vm.size === 0) return input; return vm.get(input) || vm.get(input.toLowerCase()) || input }
  if ('__valueOnly' in assignment) { const rawVal = (assignment as any).__valueOnly as string; const firstKey = Object.keys(propsSafe)[0]; if (firstKey) next[firstKey] = resolvePropValueCI(firstKey, rawVal) }
  else { for (const [rawK, rawV] of Object.entries(assignment)) { const canonical = resolvePropNameCI(rawK); if (!canonical) continue; next[canonical] = resolvePropValueCI(canonical, rawV) } }
  try { instance.setProperties(next) } catch {}
}


export async function setInstanceVariantsStrict(instance: InstanceNode, raw: string) {
  let main: ComponentNode | null = null
  try { main = await instance.getMainComponentAsync() } catch { main = null }
  if (!main) return
  const props = (main as any).variantProperties as Record<string, string> | undefined
  if (!props || Object.keys(props).length === 0) return
  const expectedOrder = Object.keys(props)

  // Parse raw by commas, preserve order and exact keys
  const parts = String(raw).split(/\s*,\s*/).filter(Boolean)
  if (parts.length !== expectedOrder.length) return
  const ordered: Array<{ key: string; value: string }> = []
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    const eq = seg.indexOf('=')
    if (eq < 0) return
    const k = seg.slice(0, eq).trim()
    const v = seg.slice(eq + 1).trim()
    if (!k || !v) return
    // enforce exact key and order
    if (k !== expectedOrder[i]) return
    ordered.push({ key: k, value: v })
  }
  // Build value map for exact values present in component set
  const propValuesExact = new Map<string, Set<string>>()
  expectedOrder.forEach((p) => propValuesExact.set(p, new Set<string>()))
  const parent = (main as any).parent
  if (parent && 'children' in parent) {
    for (const child of parent.children as readonly SceneNode[]) {
      const comp = child as any
      if (comp && comp.type === 'COMPONENT' && comp.variantProperties) {
        const vp = comp.variantProperties as Record<string, string>
        for (const [k, v] of Object.entries(vp)) {
          if (!propValuesExact.has(k)) propValuesExact.set(k, new Set<string>())
          propValuesExact.get(k)!.add(String(v))
        }
      }
    }
  }
  const next: { [key: string]: string } = {}
  for (const { key, value } of ordered) {
    const allowed = propValuesExact.get(key)
    if (!allowed || !allowed.has(value)) return
    next[key] = value
  }
  try { instance.setProperties(next) } catch {}
}


