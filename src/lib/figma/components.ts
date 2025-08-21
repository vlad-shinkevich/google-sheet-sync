export function findMainComponentByNameInScope(scopeRoot: BaseNode & { children?: readonly SceneNode[] }, name: string): ComponentNode | null {
  const target = String(name)
  let found: ComponentNode | null = null
  function visit(n: SceneNode) {
    if (found) return
    if ((n as any).type === 'COMPONENT' && (n as any).name === target) {
      found = n as any
      return
    }
    if ('children' in n) { for (const c of n.children) visit(c as SceneNode) }
  }
  if ('children' in scopeRoot) {
    for (const c of (scopeRoot.children || [])) visit(c as SceneNode)
  }
  return found
}


