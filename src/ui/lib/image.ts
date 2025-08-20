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
            const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType`
            const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token.access_token}` } })
            if (metaRes.ok) {
              const meta = await metaRes.json()
              const mime = String(meta?.mimeType || '')
              const thumb = String(meta?.thumbnailLink || '')
              if (mime.startsWith('image/')) {
                const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
                const r = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token.access_token}` } })
                if (r.ok) {
                  const buf = await r.arrayBuffer()
                  ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
                  return
                }
              } else if (thumb) {
                const proxiedThumb = `https://google-sheet-sync-api.vercel.app/api/proxy?url=${encodeURIComponent(thumb)}`
                const rt = await fetch(proxiedThumb)
                if (rt.ok) {
                  const buf = await rt.arrayBuffer()
                  ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
                  return
                }
              }
            }
            // Fallback to original media via Drive
            const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
            const r = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token.access_token}` } })
            if (r.ok) {
              const buf = await r.arrayBuffer()
              ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
              return
            }
          }
        }
        // Fallback: backend proxy
        const proxyUrl = `https://google-sheet-sync-api.vercel.app/api/proxy?url=${encodeURIComponent(url)}`
        const res = await fetch(proxyUrl)
        if (!res.ok) throw new Error(String(res.status))
        const buf = await res.arrayBuffer()
        ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: true, buffer: buf } }, '*')
      } catch (error) {
        ;(parent as any).postMessage({ pluginMessage: { type: 'image/fetch:result', id, ok: false, error: String(error) } }, '*')
      }
    })()
  }
  if (active) window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

function extractDriveFileId(u: string): string | null {
  try {
    const parsed = new URL(u)
    const host = parsed.hostname
    if (host.includes('drive.google.com')) {
      const m = parsed.pathname.match(/\/file\/d\/([^/]+)/)
      if (m && m[1]) return m[1]
      const qid = parsed.searchParams.get('id')
      if (qid) return qid
    }
    if (parsed.searchParams.get('export') === 'download') {
      const qid = parsed.searchParams.get('id')
      if (qid) return qid
    }
  } catch {}
  return null
}


