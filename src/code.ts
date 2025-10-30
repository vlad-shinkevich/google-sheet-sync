// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Load built UI HTML directly and pass to showUI
// Note: This depends on UI being built first (our scripts do build:ui before build:code)
import uiHtml from '../dist/src/ui/ui.html?raw'
// Utilities extracted to dedicated modules
import { findTagFromName, collectNodesByTag } from './lib/figma/layers'
import { loadAllFontsInNode } from './lib/figma/text'
import { parseSolidPaintFromColor } from './lib/figma/colors'
import { createImagePaintFromUrl } from './lib/figma/images'
import { parseVariantAssignments, setInstanceVariants, setInstanceVariantsStrict } from './lib/figma/variants'
import { findMainComponentByNameInScope } from './lib/figma/components'
import { isSpecialPrefixed, stripSpecialPrefix, getVisibilityAction } from './lib/figma/special'

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

// moved to ./lib/figma/layers

function detectFieldType(value: string, tagKey?: string): 'image' | 'link' | 'text' | 'color' | 'variant' {
    const v = String(value || '').trim()
    if (!v) return 'text'
    
    // Tag-driven hints first
    if (tagKey && /variant/i.test(tagKey)) return 'variant'
    if (tagKey && /color|colour/i.test(tagKey)) return 'color'
    if (tagKey && /image|img|photo|picture|thumbnail|thumb|avatar|icon/i.test(tagKey)) return 'image'
    
    // Check if it's a URL starting with http:// or https://
    if (/^https?:\/\//i.test(v)) {
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
            // If URL parsing fails, treat as link anyway
            return 'link'
        }
    }
    
    // Possible color literals (hex)
    if (/^#([0-9a-f]{3,8})$/i.test(v)) return 'color'
    
    // Possible variant assignment syntax (Prop=Value, Prop2=Value)
    // Must contain '=' and not start with http
    if (/=/.test(v)) return 'variant'
    
    return 'text'
}

// moved to ./lib/figma/layers (NodesByTag internal)

// moved to ./lib/figma/layers

// moved to ./lib/figma/layers

// moved to ./lib/figma/text

async function applyRowToClone(clone: SceneNode, row: RowData): Promise<{ updated: number; skipped: number; missing: string[] }> {
    let updated = 0
    let skipped = 0
    const missing: string[] = []
    const byTag = collectNodesByTag(clone)
    const allTags = new Set<string>([
        ...byTag.text.keys(),
        ...byTag.fillable.keys(),
        ...byTag.instances.keys(),
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
        if (type !== 'image' && /image|img|photo|picture|thumbnail|thumb|avatar|icon/i.test(key)) {
            type = 'image'
            try { console.log('[SYNC] forcing type image by tag name for', key) } catch {}
        }
        try { console.log('[SYNC] tag', key, 'type', type, 'value', String(value).slice(0, 120)) } catch {}
        // Update text nodes (enforce '/' prefix for special types on text layers)
        const texts = byTag.text.get(key) || []
        for (const t of texts) {
            try {
                await loadAllFontsInNode(t)
                // Show/Hide for text layers requires '/'
                const vis = getVisibilityAction(String(value), true)
                if (vis) { t.visible = (vis === 'show'); updated++; continue }

                const raw = String(value)
                const isSpecial = isSpecialPrefixed(raw)
                if (isSpecial) {
                    const stripped = stripSpecialPrefix(raw)
                    // Color for text must be prefixed '/'
                    const solid = parseSolidPaintFromColor(stripped)
                    if (solid) { t.fills = [solid]; updated++; continue }
                    // Otherwise, unknown special on text → skip
                    skipped++; continue
                }

                // Non-special: text content or hyperlink
                if (type === 'link') {
                    t.characters = String(value)
                    try { t.setRangeHyperlink(0, t.characters.length, { type: 'URL', value: String(value) }) } catch {}
                    updated++
                } else {
                    // Treat image/link/text fallback as plain text
                    t.characters = String(value)
                    updated++
                }
            } catch { skipped++ }
        }

        // Show/Hide for fillable nodes (no '/' required)
        {
            const nodes = byTag.fillable.get(key) || []
            const vis = getVisibilityAction(String(value), false)
            if (vis && nodes.length > 0) {
                for (const n of nodes) { try { n.visible = (vis === 'show'); updated++ } catch { skipped++ } }
            }
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
            const paint = parseSolidPaintFromColor(stripSpecialPrefix(String(value)))
            try { console.log('[SYNC] color value', value, 'paint', !!paint, 'fillable nodes', nodes.length) } catch {}
            if (paint && nodes.length > 0) {
                for (const n of nodes) {
                    try { (n as any).fills = [paint]; updated++ } catch { skipped++ }
                }
            } else if (!paint) {
                skipped += nodes.length
            }
        }
        // Update instances for components and variants
        if (byTag.instances.has(key)) {
            const instances = byTag.instances.get(key) || []
            if (instances.length > 0) {
                const raw = String(value)
                if (raw.includes('=')) {
                    // Variant by exact order and full set as in reference (no '/' required)
                    for (const inst of instances) {
                        try { await setInstanceVariantsStrict(inst, raw); updated++ } catch { skipped++ }
                    }
                } else {
                    // Component swap by main component name
                    const main = findMainComponentByNameInScope(figma.currentPage as any, raw)
                    if (!main) { skipped += instances.length }
                    else {
                        for (const inst of instances) {
                            try { inst.swapComponent(main); updated++ } catch { skipped++ }
                        }
                    }
                }
            }
        }
    }
    return { updated, skipped, missing }
}

// moved to ./lib/figma/colors

// group color support removed per spec

// moved to ./lib/figma/variants

// moved to ./lib/figma/variants

// moved to ./lib/figma/images

// moved to ./lib/figma/images

// moved to ./lib/figma/images

// keep local helper using imported findTagFromName
function collectEligibleLayers(root: SceneNode): Array<{ id: string; name: string; tag: string }> {
    const result: Array<{ id: string; name: string; tag: string }> = []
    function visit(n: SceneNode) {
        const name = (n as any).name || ''
        const tag = findTagFromName(name)
        if (tag) result.push({ id: n.id, name, tag })
        if ('children' in n) for (const c of n.children) visit(c as SceneNode)
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



