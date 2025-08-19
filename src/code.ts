// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// Load built UI HTML directly and pass to showUI
// Note: This depends on UI being built first (our scripts do build:ui before build:code)
import uiHtml from '../dist/src/ui/ui.html?raw'

// Runs this code if the plugin is run in Figma
if (figma.editorType === 'figma') {
    figma.showUI(uiHtml, { width: 640, height: 420 });
}

// Runs this code if the plugin is run in FigJam
if (figma.editorType === 'figjam') {
    figma.showUI(uiHtml, { width: 640, height: 420 });
}

// Runs this code if the plugin is run in Slides
if (figma.editorType === 'slides') {
    figma.showUI(uiHtml, { width: 640, height: 420 });
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

function detectFieldType(value: string): 'image' | 'link' | 'text' {
    const v = String(value || '').trim()
    if (!v) return 'text'
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
        return 'text'
    }
}

type NodesByTag = {
    text: Map<string, TextNode[]>
    fillable: Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>
}

function collectNodesByTag(node: SceneNode): NodesByTag {
    const text = new Map<string, TextNode[]>()
    const fillable = new Map<string, (SceneNode & { fills: readonly Paint[] | PluginAPI['mixed']; })[]>()
    function visit(n: SceneNode) {
        const tag = findTagFromName((n as any).name || '')
        if (n.type === 'TEXT') {
            if (tag) {
                const arr = text.get(tag) || []
                arr.push(n as TextNode)
                text.set(tag, arr)
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
    return { text, fillable }
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
    const allTags = new Set<string>([...byTag.text.keys(), ...byTag.fillable.keys()])
    try { console.log('[SYNC] tags found:', Array.from(allTags)) } catch {}
    try { console.log('[SYNC] row keys:', Object.keys(row)) } catch {}
    for (const key of allTags) {
        const value = row[key]
        if (value === undefined) {
            try { console.log('[SYNC] missing value for tag', key) } catch {}
            missing.push(key); continue
        }
        let type = detectFieldType(value)
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
    }
    return { updated, skipped, missing }
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



