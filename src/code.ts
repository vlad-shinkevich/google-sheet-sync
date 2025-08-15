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
}

type RowData = Record<string, string>

function normalizeKey(s: string): string {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function findTagFromName(name: string): string | null {
    const m = name.match(/#([a-z0-9_]+)/i)
    return m ? normalizeKey(m[1]) : null
}

function collectAllTextNodes(node: SceneNode): TextNode[] {
    const result: TextNode[] = []
    function visit(n: SceneNode) {
        if (n.type === 'TEXT') {
            result.push(n as TextNode)
            return
        }
        if ('children' in n) {
            for (const c of n.children) visit(c as SceneNode)
        }
    }
    visit(node)
    return result
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
    const texts = collectAllTextNodes(clone)
    for (const t of texts) {
        const key = findTagFromName(t.name)
        if (!key) { skipped++; continue }
        const value = row[key]
        if (value === undefined) { missing.push(key); skipped++; continue }
        await loadAllFontsInNode(t)
        try {
            t.characters = String(value ?? '')
            updated++
        } catch (e) {
            skipped++
        }
    }
    return { updated, skipped, missing }
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


