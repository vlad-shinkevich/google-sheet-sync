export type RowData = Record<string, string>

export type ConfirmPayload = {
  selectedTabs: string[]
  byTab: Record<string, { headers: Array<{ key: string; label: string }>; rows: RowData[] }>
}


