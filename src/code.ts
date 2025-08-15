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
}


