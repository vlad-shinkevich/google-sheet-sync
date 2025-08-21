export function normalizeKey(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

export function findTagFromName(name: string): string | null {
  const m = name.match(/#([a-z0-9_]+)/i)
  return m ? normalizeKey(m[1]) : null
}

export type NodesByTag = {
  text: Map<string, TextNode[]>
  fillable: Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>
  instances: Map<string, InstanceNode[]>
}

export function isInstanceNode(n: SceneNode): n is InstanceNode {
  const anyN = n as any
  return anyN && typeof anyN.getMainComponentAsync === 'function' && typeof anyN.setProperties === 'function' && 'variantProperties' in anyN
}

export function collectNodesByTag(node: SceneNode): NodesByTag {
  const text = new Map<string, TextNode[]>()
  const fillable = new Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>()
  const instances = new Map<string, InstanceNode[]>()
  function visit(n: SceneNode) {
    const tag = findTagFromName((n as any).name || '')
    if (n.type === 'TEXT') {
      if (tag) { const arr = text.get(tag) || []; arr.push(n as TextNode); text.set(tag, arr) }
    } else if (isInstanceNode(n)) {
      if (tag) { const arr = instances.get(tag) || []; arr.push(n); instances.set(tag, arr) }
    } else if ('fills' in n) {
      if (tag) { const arr = fillable.get(tag) || []; arr.push(n as any); fillable.set(tag, arr) }
    }
    if ('children' in n) { for (const c of n.children) visit(c as SceneNode) }
  }
  visit(node)
  return { text, fillable, instances }
}


