import { extractDriveFileId, fetchGoogle, fetchGoogleDriveBytes, fetchProxyBytes } from '@/ui/lib/api'

export function attachImageFetchHandler(active: boolean) {
  function onMessage(e: MessageEvent) {
    const msg = (e.data && (e as any).data.pluginMessage) || (e as any).data
    if (msg?.type !== 'image/fetch') return
    const { id, url } = msg
    ;(async () => {
      try {
        // Try Google Drive API first if URL refers to Drive
        const fileId = extractDriveFileId(url)
        if (fileId) {
          ;(parent as any).postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
          const token = await new Promise<any>((resolve) => {
            function onTok(e2: MessageEvent) {
              const m2 = ((e2.data as any) && (e2 as any).data.pluginMessage) || (e2 as any).data
              if (m2?.type === 'oauth/token') {
                window.removeEventListener('message', onTok)
                resolve(m2.token)
              }
            }
            window.addEventListener('message', onTok)
          })
          if (token?.access_token) {
            const meta = await fetchGoogle<any>(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType`, token.access_token).catch(()=>null)
            const mime = String(meta?.mimeType || '')
            const thumb = String(meta?.thumbnailLink || '')
            if (mime.startsWith('image/')) {
              const buf = await fetchGoogleDriveBytes(fileId, token.access_token)
              ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
              return
            } else if (thumb) {
              const buf = await fetchProxyBytes(thumb)
              ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
              return
            }
            // Fallback to original media via Drive
            const buf = await fetchGoogleDriveBytes(fileId, token.access_token)
            ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
            return
          }
        }
        // Fallback: backend proxy
        const buf = await fetchProxyBytes(url)
        ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
      } catch (error) {
        ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: false, error: String(error) } }, '*')
      }
    })()
  }
  if (active) window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
