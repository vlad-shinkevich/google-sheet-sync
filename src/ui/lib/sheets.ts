import type { RowData } from '@/ui/types'
import { fetchGoogleJson } from '@/ui/lib/api'

export function parseSheetId(url: string): string | null {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m?.[1] ?? null
}

export async function fetchSheetMeta(sheetId: string, accessToken: string): Promise<Array<{ id: number; title: string }>> {
  const meta = await fetchGoogleJson<any>(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title,index))`,
    accessToken
  )
  const list = (meta?.sheets ?? []).map((s:any)=>({ id: s.properties.sheetId, title: s.properties.title }))
  return list
}

export async function fetchValuesFor(sheetId: string, accessToken: string, sheetTitle: string): Promise<{ headers: Array<{ key: string; label: string }>; rows: RowData[] }> {
  const rangeTitle = `'${sheetTitle}'!A1:Z10000`
  const res = await fetchGoogleJson<any>(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeTitle)}`, accessToken)
  const values: string[][] = res?.values ?? []
  const maxCols = values.reduce((m, r) => Math.max(m, r?.length ?? 0), 0)
  const headerRow = values[0] ?? []
  const labels = Array.from({ length: maxCols }, (_, i) => String(headerRow[i] ?? `Column ${i+1}`))
  const toKey = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const preliminary = labels.map(toKey)
  const used = new Set<string>()
  const keys = preliminary.map((k, i) => {
    let base = k || `col_${i+1}`
    let name = base
    let n = 1
    while (used.has(name)) { name = `${base}_${n++}` }
    used.add(name)
    return name
  })
  const dataRows: RowData[] = (values.length > 1 ? values.slice(1) : []).map((row) => {
    const obj: RowData = {}
    keys.forEach((k, i) => { obj[k] = (row && row[i] !== undefined ? row[i] : '') })
    return obj
  })
  return { headers: labels.map((label, i) => ({ label, key: keys[i] })), rows: dataRows }
}


