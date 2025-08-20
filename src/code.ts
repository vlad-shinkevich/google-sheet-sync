// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Load built UI HTML directly and pass to showUI
// Note: This depends on UI being built first (our scripts do build:ui before build:code)
import uiHtml from '../dist/src/ui/ui.html?raw'

// Show UI with fallback to minimal HTML if embedded UI fails to parse
const uiSize = { width: 640, height: 420 }
try {
    figma.showUI(uiHtml, uiSize)
} catch (e) {
    const fallback = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;padding:16px}</style></head><body><h3>UI failed to load</h3><p>Please try Reload. If the issue persists, check console logs.</p></body></html>`
    try { figma.showUI(fallback, uiSize) } catch {}
    try { figma.notify('Failed to load UI, fallback opened') } catch {}
}

figma.ui.onmessage = (msg) => {
    if (msg.type === 'log') {
        const text = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message)
        try { console.log(`[UI LOG] ${text}`) } catch {}
        if (msg.notify) {
            try { figma.notify(String(text).slice(0, 120)) } catch {}
        }
    }
    if (msg.type === 'resize' && typeof msg.width === 'number' && typeof msg.height === 'number') {
        const w = Math.max(70, Math.round(msg.width))
        const h = Math.max(0, Math.round(msg.height))
        figma.ui.resize(w, h)
    }
    if (msg.type === 'oauth/open' && typeof msg.url === 'string') {
        figma.openExternal(msg.url)
    }
    if (msg.type === 'oauth/save' && (msg.token || msg.userinfo)) {
        const ops: Promise<any>[] = []
        if (msg.token) ops.push(figma.clientStorage.setAsync('googleTokens', msg.token))
        if (msg.userinfo) ops.push(figma.clientStorage.setAsync('googleUserinfo', msg.userinfo))
        Promise.all(ops).then(() => {
            figma.notify('Google connected')
        })
    }
    if (msg.type === 'oauth/get') {
        Promise.all([
            figma.clientStorage.getAsync('googleTokens'),
            figma.clientStorage.getAsync('googleUserinfo'),
        ]).then(([token, userinfo]) => {
            figma.ui.postMessage({ type: 'oauth/token', token, userinfo })
        })
    }
    if (msg.type === 'oauth/clear') {
        Promise.all([
            figma.clientStorage.setAsync('googleTokens', null as any),
            figma.clientStorage.setAsync('googleUserinfo', null as any),
        ]).then(() => {
            figma.notify('Google auth reset')
            figma.ui.postMessage({ type: 'oauth/token', token: null, userinfo: null })
        })
    }
    if (msg.type === 'sync/text' && msg.payload) {
        handleSyncText(msg.payload as any).catch((error) => {
            try { figma.notify('Sync failed') } catch {}
            try { console.error('sync/text error', error) } catch {}
            figma.ui.postMessage({ type: 'sync/text:result', error: String(error) })
        })
    }
    if (msg.type === 'layers/getForSelection') {
        const selection = figma.currentPage.selection
        const target = selection && selection[0]
        if (!target) {
            figma.ui.postMessage({ type: 'layers/eligible', layers: [] })
            return
        }
        const layers = collectEligibleLayers(target)
        figma.ui.postMessage({ type: 'layers/eligible', layers })
    }
}

type RowData = Record<string, string>

function normalizeKey(s: string): string {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function findTagFromName(name: string): string | null {
    const m = name.match(/#([a-z0-9_]+)/i)
    return m ? normalizeKey(m[1]) : null
}

function detectFieldType(value: string, tagKey?: string): 'image' | 'link' | 'text' | 'color' | 'variant' {
    const v = String(value || '').trim()
    if (!v) return 'text'
    // Tag-driven hints
    if (tagKey && /variant/i.test(tagKey)) return 'variant'
    if (tagKey && /color|colour/i.test(tagKey)) return 'color'
    try {
        const u = new URL(v)
        const host = u.host.toLowerCase()
        const pathname = u.pathname.toLowerCase()
        const isImageExt = /\.(png|jpe?g|gif|webp|svg)$/i.test(pathname)
        const isGDrive = host.endsWith('googleusercontent.com') || host.includes('drive.google.com')
        const knownCdn = host.includes('unsplash.com') || host.includes('picsum.photos') || host.includes('cloudinary.com')
        if (isImageExt || isGDrive || knownCdn) return 'image'
        return 'link'
    } catch {
        // Possible color literals (hex)
        if (/^#([0-9a-f]{3,8})$/i.test(v)) return 'color'
        // Possible variant assignment syntax (Prop=Value|Prop2=Value2)
        if (/=/.test(v)) return 'variant'
        return 'text'
    }
}

type NodesByTag = {
    text: Map<string, TextNode[]>
    fillable: Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>
    instances: Map<string, InstanceNode[]>
}

function isInstanceNode(n: SceneNode): n is InstanceNode {
    const anyN = n as any
    return (
        anyN &&
        typeof anyN.getMainComponentAsync === 'function' &&
        typeof anyN.setProperties === 'function' &&
        'variantProperties' in anyN
    )
}

function collectNodesByTag(node: SceneNode): NodesByTag {
    const text = new Map<string, TextNode[]>()
    const fillable = new Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>()
    const instances = new Map<string, InstanceNode[]>()
    function visit(n: SceneNode) {
        const tag = findTagFromName((n as any).name || '')
        if (n.type === 'TEXT') {
            if (tag) {
                const arr = text.get(tag) || []
                arr.push(n as TextNode)
                text.set(tag, arr)
            }
        } else if (isInstanceNode(n)) {
            if (tag) {
                const arr = instances.get(tag) || []
                arr.push(n)
                instances.set(tag, arr)
            }
        } else if ('fills' in n) {
            if (tag) {
                const arr = fillable.get(tag) || []
                arr.push(n as any)
                fillable.set(tag, arr)
            }
        }
        if ('children' in n) {
            for (const c of n.children) visit(c as SceneNode)
        }
    }
    visit(node)
    return { text, fillable, instances }
}

async function loadAllFontsInNode(textNode: TextNode): Promise<void> {
    const len = textNode.characters.length
    if (len === 0) return
    if (textNode.fontName !== figma.mixed) {
        await figma.loadFontAsync(textNode.fontName as FontName)
        return
    }
    let i = 0
    while (i < len) {
        const font = textNode.getRangeFontName(i, i + 1) as FontName
        await figma.loadFontAsync(font)
        let j = i + 1
        while (j < len) {
            const f2 = textNode.getRangeFontName(j, j + 1) as FontName
            if (f2.family !== font.family || f2.style !== font.style) break
            j++
        }
        i = j
    }
}

async function applyRowToClone(clone: SceneNode, row: RowData): Promise<{ updated: number; skipped: number; missing: string[] }> {
    let updated = 0
    let skipped = 0
    const missing: string[] = []
    const byTag = collectNodesByTag(clone)
    const allTags = new Set<string>([
        ...byTag.text.keys(),
        ...byTag.fillable.keys(),
        ...byTag.instances.keys(),
        ...(byTag as any).groups ? [...(byTag as any).groups.keys()] : [],
    ])
    try { console.log('[SYNC] tags found:', Array.from(allTags)) } catch {}
    try { console.log('[SYNC] row keys:', Object.keys(row)) } catch {}
    for (const key of allTags) {
        const value = row[key]
        if (value === undefined) {
            try { console.log('[SYNC] missing value for tag', key) } catch {}
            missing.push(key); continue
        }
        let type = detectFieldType(value, key)
        if (type !== 'image' && /image|img|photo|picture/i.test(key)) {
            type = 'image'
            try { console.log('[SYNC] forcing type image by tag name for', key) } catch {}
        }
        try { console.log('[SYNC] tag', key, 'type', type, 'value', String(value).slice(0, 120)) } catch {}
        // Update text nodes
        const texts = byTag.text.get(key) || []
        for (const t of texts) {
            try {
                await loadAllFontsInNode(t)
                if (type === 'link') {
                    t.characters = String(value)
                    // add hyperlink to full range
                    try { t.setRangeHyperlink(0, t.characters.length, { type: 'URL', value: String(value) }) } catch {}
                    updated++
                } else if (type === 'text' || type === 'image') {
                    // For image type on text node, fallback to setting text
                    t.characters = String(value)
                    updated++
                } else if (type === 'color') {
                    // Apply text fill color
                    const solid = parseSolidPaintFromColor(String(value))
                    if (solid) {
                        t.fills = [solid]
                        updated++
                    } else {
                        skipped++
                    }
                }
            } catch { skipped++ }
        }
        // Update fillable nodes with image if applicable
        if (type === 'image') {
            const nodes = byTag.fillable.get(key) || []
            try { console.log('[SYNC] image nodes for tag', key, nodes.length) } catch {}
            if (nodes.length > 0) {
                try {
                    const imagePaint = await createImagePaintFromUrl(String(value))
                    for (const n of nodes) {
                        try {
                            const fills = (Array.isArray(n.fills) ? [...n.fills] : []) as Paint[]
                            // replace all fills with image fill to keep simple
                            n.fills = [imagePaint]
                            updated++
                        } catch { skipped++ }
                    }
                } catch (err) {
                    try { console.error('[SYNC] image fetch failed for tag', key, err) } catch {}
                    skipped += nodes.length
                }
            }
        }
        // Update fillable nodes with color if applicable
        if (type === 'color') {
            const nodes = byTag.fillable.get(key) || []
            const paint = parseSolidPaintFromColor(String(value))
            try { console.log('[SYNC] color value', value, 'paint', !!paint, 'fillable nodes', nodes.length) } catch {}
            if (paint && nodes.length > 0) {
                for (const n of nodes) {
                    try { (n as any).fills = [paint]; updated++ } catch { skipped++ }
                }
            } else if (!paint) {
                skipped += nodes.length
            }
            // If color tag is on a GROUP, apply to all children with fills
            const groups = (byTag as any).groups ? ((byTag as any).groups.get(key) || []) : []
            try { console.log('[SYNC] color groups for tag', key, groups.length) } catch {}
            if (paint && groups.length > 0) {
                for (const g of groups as GroupNode[]) {
                    const u = applyFillToGroupChildren(g, paint)
                    updated += u
                    try { console.log('[SYNC] applied color to group children count', u) } catch {}
                }
            }
        }
        // Update instances (variants) if applicable
        if (type === 'variant') {
            const instances = byTag.instances.get(key) || []
            if (instances.length > 0) {
                const assignments = parseVariantAssignments(String(value))
                for (const inst of instances) {
                    try {
                        await setInstanceVariants(inst, assignments)
                        updated++
                    } catch { skipped++ }
                }
            }
        }
    }
    return { updated, skipped, missing }
}

function parseSolidPaintFromColor(input: string): SolidPaint | null {
    const s = String(input).trim()
    const m = s.match(/^#([0-9a-f]{1,8})$/i)
    if (!m) return null
    let hex = m[1]
    function hexTo01(hh: string): number { return parseInt(hh, 16) / 255 }
    let r = 0, g = 0, b = 0, a = 1
    if (hex.length === 1) {
        // #A -> #AAAAAA
        const c = hex[0]
        r = hexTo01(c + c)
        g = hexTo01(c + c)
        b = hexTo01(c + c)
    } else if (hex.length === 2) {
        // #AB -> grayscale using A, alpha from B? Spec says map to #AABBCC; but examples show #AB -> #ABABAB
        // Following provided spec: #AB -> #ABABAB
        const c1 = hex[0]
        const c2 = hex[1]
        r = hexTo01(c1 + c2)
        g = hexTo01(c1 + c2)
        b = hexTo01(c1 + c2)
    } else if (hex.length === 3) {
        r = hexTo01(hex[0] + hex[0])
        g = hexTo01(hex[1] + hex[1])
        b = hexTo01(hex[2] + hex[2])
    } else if (hex.length === 6) {
        r = hexTo01(hex.slice(0,2))
        g = hexTo01(hex.slice(2,4))
        b = hexTo01(hex.slice(4,6))
    } else if (hex.length === 8) {
        r = hexTo01(hex.slice(0,2))
        g = hexTo01(hex.slice(2,4))
        b = hexTo01(hex.slice(4,6))
        a = hexTo01(hex.slice(6,8))
    } else {
        return null
    }
    const paint: SolidPaint = { type: 'SOLID', color: { r, g, b }, opacity: a }
    return paint
}

function applyFillToGroupChildren(group: GroupNode, paint: SolidPaint): number {
    let updated = 0
    function visit(n: SceneNode) {
        if ('fills' in n) {
            try { (n as any).fills = [paint]; updated++ } catch {}
        }
        if ('children' in n) {
            for (const c of n.children) visit(c as SceneNode)
        }
    }
    for (const c of group.children) visit(c as SceneNode)
    return updated
}

function parseVariantAssignments(input: string): Record<string, string> | { __valueOnly: string } {
    const raw = String(input).trim()
    const parts = raw.split(/\s*[|,]\s*/).filter(Boolean)
    const map: Record<string, string> = {}
    let valueOnly: string | null = null
    for (const p of parts) {
        const eq = p.indexOf('=')
        if (eq > -1) {
            const k = p.slice(0, eq).trim()
            const v = p.slice(eq + 1).trim()
            if (k && v) map[k] = v
        } else {
            // Single value (no prop); remember first
            if (!valueOnly) valueOnly = p.trim()
        }
    }
    if (Object.keys(map).length > 0) return map
    if (valueOnly) return { __valueOnly: valueOnly }
    return {}
}

async function setInstanceVariants(instance: InstanceNode, assignment: Record<string, string> | { __valueOnly: string }) {
    let main: ComponentNode | null = null
    try { main = await instance.getMainComponentAsync() } catch { main = null }
    if (!main) return
    const props = (main as any).variantProperties as Record<string, string> | undefined
    if (!props || Object.keys(props).length === 0) return
    const propsSafe = props as Record<string, string>
    const current = instance.variantProperties || {}
    const next: { [key: string]: string } = { ...current }

    // Collect canonical prop names and all possible values from the component set
    const propNameMapCI = new Map<string, string>()
    const propValuesMapCI = new Map<string, Map<string, string>>()
    for (const propName of Object.keys(props)) {
        propNameMapCI.set(propName.toLowerCase(), propName)
        propValuesMapCI.set(propName, new Map<string, string>())
    }
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
    try {
        console.log('[VARIANT] available props', Array.from(propNameMapCI.values()))
        const options: Record<string, string[]> = {}
        propValuesMapCI.forEach((vm, k) => { options[k] = Array.from(vm.values()) })
        console.log('[VARIANT] available values', options)
    } catch {}

    function resolvePropNameCI(input: string): string | null {
        const exact = propsSafe[input] ? input : null
        if (exact) return exact
        const lower = input.toLowerCase()
        return propNameMapCI.get(lower) || null
    }
    function resolvePropValueCI(propCanonical: string, input: string): string {
        const vm = propValuesMapCI.get(propCanonical)
        if (!vm || vm.size === 0) return input
        const exact = vm.get(input)
        if (exact) return exact
        const lower = input.toLowerCase()
        return vm.get(lower) || input
    }

    if ('__valueOnly' in assignment) {
        const rawVal = (assignment as any).__valueOnly as string
        const firstKey = Object.keys(props)[0]
        if (firstKey) next[firstKey] = resolvePropValueCI(firstKey, rawVal)
    } else {
        for (const [rawK, rawV] of Object.entries(assignment)) {
            const canonical = resolvePropNameCI(rawK)
            if (!canonical) { try { console.warn('[VARIANT] unknown prop', rawK) } catch {}; continue }
            const resolvedVal = resolvePropValueCI(canonical, rawV)
            next[canonical] = resolvedVal
            try { console.log('[VARIANT] set', canonical, '=>', resolvedVal) } catch {}
        }
    }
    try { console.log('[VARIANT] current', current, 'next', next) } catch {}
    try { instance.setProperties(next) } catch (e) { try { console.error('[VARIANT] setProperties error', e) } catch {} }
}

function toGoogleDriveDownloadUrl(url: string): string {
    try {
        const u = new URL(url)
        if (u.host.includes('drive.google.com')) {
            // formats: /file/d/FILE_ID/view or uc?id=FILE_ID
            const m = u.pathname.match(/\/file\/d\/([^/]+)/)
            const id = m ? m[1] : (u.searchParams.get('id') || '')
            if (id) {
                return `https://drive.google.com/uc?export=download&id=${id}`
            }
        }
        return url
    } catch { return url }
}

async function createImagePaintFromUrl(url: string): Promise<ImagePaint> {
    const normalized = toGoogleDriveDownloadUrl(url)
    try { console.log('[SYNC] fetch image', normalized) } catch {}
    const buf = await fetchImageBytesViaUI(normalized)
    const image = figma.createImage(buf)
    const paint: ImagePaint = {
        type: 'IMAGE',
        imageHash: image.hash,
        scaleMode: 'FILL',
    }
    try { console.log('[SYNC] image created hash', image.hash) } catch {}
    return paint
}

function fetchImageBytesViaUI(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
        function onMsg(msg: any) {
            if (msg.type === 'image/fetch:result' && msg.id === id) {
                figma.ui.off('message', onMsg)
                if (msg.ok && msg.buffer) {
                    const buf = new Uint8Array(msg.buffer as ArrayBuffer)
                    resolve(buf)
                } else {
                    reject(new Error(msg.error || 'fetch failed'))
                }
            }
        }
        figma.ui.on('message', onMsg)
        figma.ui.postMessage({ type: 'image/fetch', id, url })
    })
}

function collectEligibleLayers(root: SceneNode): Array<{ id: string; name: string; tag: string }> {
    const result: Array<{ id: string; name: string; tag: string }> = []
    function visit(n: SceneNode) {
        const name = (n as any).name || ''
        const tag = findTagFromName(name)
        if (tag) {
            result.push({ id: n.id, name, tag })
        }
        if ('children' in n) {
            for (const c of n.children) visit(c as SceneNode)
        }
    }
    visit(root)
    return result
}

async function handleSyncText(payload: { sets: Array<{ tabTitle: string; headers: Array<{ key: string; label: string }>; rows: RowData[] }> }) {
    const selection = figma.currentPage.selection
    if (!selection || selection.length === 0) {
        figma.notify('Select a frame to use as a template')
        figma.ui.postMessage({ type: 'sync/text:result', error: 'No selection' })
        return
    }
    const template = selection[0]
    const parent = template.parent
    if (!parent || !('appendChild' in parent)) {
        figma.notify('Cannot duplicate here')
        figma.ui.postMessage({ type: 'sync/text:result', error: 'Invalid parent' })
        return
    }

    // Aggregate rows across all sets
    const allRows: RowData[] = []
    for (const s of payload.sets) {
        for (const r of s.rows) allRows.push(r)
    }
    if (allRows.length === 0) {
        figma.notify('No rows selected')
        figma.ui.postMessage({ type: 'sync/text:result', error: 'No rows' })
        return
    }

    const gap = 80
    const clones: SceneNode[] = []
    let totalUpdated = 0
    let totalSkipped = 0
    const totalMissing: Set<string> = new Set()

    async function createTemplateInstance(): Promise<SceneNode> {
        if (template.type === 'COMPONENT') {
            return (template as ComponentNode).createInstance()
        }
        if (template.type === 'INSTANCE') {
            // With dynamic-page documentAccess we must use async API
            let main: ComponentNode | null = null
            try {
                main = await (template as InstanceNode).getMainComponentAsync()
            } catch {
                main = null
            }
            if (!main) {
                figma.notify('Selected instance is detached; cloning instead')
                return template.clone()
            }
            return main.createInstance()
        }
        return template.clone()
    }

    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i]
        const clone = await createTemplateInstance()
        ;(clone as BaseNode).name = `${(template as BaseNode).name} #${i + 1}`
        parent.appendChild(clone)
        if ('x' in clone && 'y' in clone && 'height' in template) {
            try {
                clone.x = template.x
                clone.y = template.y + (template as any).height * (i + 1) + gap * (i + 1)
            } catch {}
        }
        const { updated, skipped, missing } = await applyRowToClone(clone, row)
        totalUpdated += updated
        totalSkipped += skipped
        missing.forEach((m) => totalMissing.add(m))
        clones.push(clone)
    }

    figma.notify(`Created ${clones.length} clones, updated ${totalUpdated} text nodes`)
    figma.ui.postMessage({
        type: 'sync/text:result',
        result: {
            clones: clones.length,
            updated: totalUpdated,
            skipped: totalSkipped,
            missingFields: Array.from(totalMissing),
        },
    })
}



