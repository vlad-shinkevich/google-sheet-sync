export function uiLog(message: any, notify = false) {
  try { console.debug('[UI]', message) } catch {}
  try {
    parent.postMessage({ pluginMessage: { type: 'log', message, notify } }, '*')
  } catch {}
}


