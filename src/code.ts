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
    if (msg.type === 'resize' && typeof msg.width === 'number' && typeof msg.height === 'number') {
        const w = Math.max(70, Math.round(msg.width))
        const h = Math.max(0, Math.round(msg.height))
        figma.ui.resize(w, h)
    }
}


