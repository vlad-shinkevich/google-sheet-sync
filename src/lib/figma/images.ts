export async function createImagePaintFromUrl(url: string): Promise<ImagePaint> {
  const buf = await fetchImageBytesViaUI(url)
  const image = figma.createImage(buf)
  const paint: ImagePaint = { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
  return paint
}

export function fetchImageBytesViaUI(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    function onMsg(msg: any) {
      if (msg.type === 'image/fetch:result' && msg.id === id) {
        figma.ui.off('message', onMsg)
        if (msg.ok && msg.buffer) resolve(new Uint8Array(msg.buffer as ArrayBuffer))
        else reject(new Error(msg.error || 'fetch failed'))
      }
    }
    figma.ui.on('message', onMsg)
    figma.ui.postMessage({ type: 'image/fetch', id, url })
  })
}


