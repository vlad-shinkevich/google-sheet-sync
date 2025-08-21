// Centralized UI-side API helpers (fetch wrappers)

type HeadersInit = Record<string, string>

export async function fetchGoogle<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = { ...(init?.headers as any), Authorization: `Bearer ${accessToken}` }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchGoogleJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T | null> {
  try { return await fetchGoogle<T>(url, accessToken, init) } catch { return null }
}

export async function fetchGoogleDriveBytes(fileId: string, accessToken: string): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.arrayBuffer()
}

export async function fetchProxyBytes(url: string): Promise<ArrayBuffer> {
  const proxyUrl = `https://google-sheet-sync-api.vercel.app/api/proxy?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.arrayBuffer()
}

export async function fetchOAuthStart(): Promise<{ sessionId: string; url: string }> {
  const r = await fetch('https://google-sheet-sync-api.vercel.app/api/oauth/start')
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

export async function fetchOAuthPoll(sessionId: string): Promise<any> {
  const r = await fetch(`https://google-sheet-sync-api.vercel.app/api/oauth/poll?sessionId=${sessionId}`)
  if (!r.ok) return null
  return r.json()
}

export function extractDriveFileId(u: string): string | null {
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

// OAuth/Google helpers
export async function fetchTokenInfo(accessToken: string): Promise<number> {
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
    return resp.status
  } catch {
    return 0
  }
}

export async function fetchUserinfo(accessToken: string): Promise<{ email?: string; name?: string; picture?: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.status === 401) return null
    if (!res.ok) return null
    const u = await res.json()
    return { email: u.email, name: u.name, picture: u.picture }
  } catch { return null }
}


