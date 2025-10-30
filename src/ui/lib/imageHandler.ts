// Handle image fetch requests from plugin code
export function attachImageFetchHandler(): () => void {
  const handler = async (event: MessageEvent) => {
    const msg = event.data?.pluginMessage || event.data
    if (msg?.type === 'image/fetch' && msg.id && msg.url) {
      try {
        const arrayBuffer = await fetchImageBytes(msg.url)
        parent.postMessage(
          {
            pluginMessage: {
              type: 'image/fetch:result',
              id: msg.id,
              ok: true,
              buffer: arrayBuffer,
            },
          },
          '*'
        )
      } catch (error) {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'image/fetch:result',
              id: msg.id,
              ok: false,
              error: String(error),
            },
          },
          '*'
        )
      }
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

async function fetchImageBytes(url: string): Promise<ArrayBuffer> {
  // Try direct fetch first
  try {
    const response = await fetch(url)
    if (response.ok) {
      return await response.arrayBuffer()
    }
  } catch (error) {
    console.warn('Direct fetch failed, trying with CORS proxy:', error)
  }

  // If direct fetch fails (CORS), use a proxy
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return await response.arrayBuffer()
}


