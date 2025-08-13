"use client"
import * as React from "react"
import { useMemo } from "react"
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
    flexRender,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { ScrollArea } from "./ui/scroll-area"
import { VerticalScrollAffordance } from "./vertical-scroll-affordance"
// Virtualization
import { useVirtualizer } from "@tanstack/react-virtual"
import { Checkbox } from "./ui/checkbox"

type RowData = Record<string, string>

export function DataTableDemo() {
    const [rowSelection, setRowSelection] = React.useState({})
    const lastIndexRef = React.useRef<number | null>(null)
    const shiftRef = React.useRef(false)
    const [sessionId, setSessionId] = React.useState<string | null>(null)
    const [sheetUrl, setSheetUrl] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [headers, setHeaders] = React.useState<Array<{ key: string; label: string }>>([
        { key: 'date', label: 'date' },
        { key: 'status', label: 'status' },
        { key: 'name', label: 'name' },
        { key: 'link', label: 'link' },
        { key: 'image', label: 'image' },
        { key: 'review', label: 'review' },
        { key: 'rework', label: 'rework' },
    ])
    const [rows, setRows] = React.useState<RowData[]>([])
    const [sheets, setSheets] = React.useState<Array<{ id: number; title: string }>>([])
    const [activeSheet, setActiveSheet] = React.useState<string | null>(null)
    const [sheetCache, setSheetCache] = React.useState<Record<string, { headers: Array<{key:string;label:string}>, rows: RowData[] }>>({})

    const columns = useMemo<ColumnDef<RowData>[]>(
        () => [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                    />
                ),
				cell: ({ row, table }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onPointerDown={(e) => {
                            // capture Shift pressed state before Radix toggles
                            shiftRef.current = e.shiftKey
                        }}
                        onCheckedChange={(value) => {
							const rows = table.getRowModel().rows
                            const idx = rows.findIndex((r) => r.id === row.id)
                            if (shiftRef.current && lastIndexRef.current !== null && idx !== -1) {
                                const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y)
								const next = { ...(table.getState().rowSelection as Record<string, boolean>) }
                                const shouldSelect = !!value
                                for (let k = a; k <= b; k++) {
                                    const id = rows[k].id
                                    if (shouldSelect) next[id] = true
                                    else delete next[id]
                                }
								table.setRowSelection(next)
                            } else {
                                row.toggleSelected(!!value)
                            }
                            lastIndexRef.current = idx
                        }}
                        aria-label={`Select ${row.id}`}
                    />
                ),
                enableSorting: false,
                enableHiding: false,
            },
            ...headers.map((h) => ({ accessorKey: h.key, header: h.label } as ColumnDef<RowData>)),
		],
        [headers],
	)

    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        state: { rowSelection },
    })

    // Virtualizer (rows)
    const parentRef = React.useRef<HTMLDivElement | null>(null)
    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 36,
        overscan: 10,
    })

    // affordance handled by component

    // OAuth start
    async function startOAuth() {
        const r = await fetch('https://google-sheet-sync-api.vercel.app/api/oauth/start').then(r=>r.json())
        setSessionId(r.sessionId)
        parent.postMessage({ pluginMessage: { type: 'oauth/open', url: r.url } }, '*')
        // simple polling
        let done = false
        while (!done) {
            await new Promise(res=>setTimeout(res, 1000))
            const polled = await fetch(`https://google-sheet-sync-api.vercel.app/api/oauth/poll?sessionId=${r.sessionId}`).then(r=>r.json()).catch(()=>null)
            if (polled?.done && polled?.result?.tokens) {
                parent.postMessage({ pluginMessage: { type: 'oauth/save', token: polled.result.tokens } }, '*')
                done = true
            }
        }
    }

    function parseSheetId(url: string): string | null {
        // Supports: https://docs.google.com/spreadsheets/d/<sheetId>/edit...
        const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
        return m?.[1] ?? null
    }

    async function loadSheet() {
        const sheetId = parseSheetId(sheetUrl)
        if (!sheetId) return alert('Paste a valid Google Sheet URL')
        setLoading(true)
        // ask worker for stored token
        parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
        const token = await new Promise<any>((resolve) => {
            function onMessage(e: MessageEvent) {
                const msg = (e.data && e.data.pluginMessage) || e.data
                if (msg?.type === 'oauth/token') {
                    window.removeEventListener('message', onMessage)
                    resolve(msg.token)
                }
            }
            window.addEventListener('message', onMessage)
        })
        if (!token?.access_token) {
            setLoading(false)
            return alert('Connect Google first')
        }
        // Example read first sheet values via Google Sheets API
        // Fetch sheets list (to render tabs)
        const meta = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title,index))`,
            { headers: { Authorization: `Bearer ${token.access_token}` } },
        ).then(r=>r.json()).catch(()=>null)
        const list = (meta?.sheets ?? []).map((s:any)=>({ id: s.properties.sheetId, title: s.properties.title }))
        setSheets(list)
        const title = list[0]?.title
        setActiveSheet(title ?? null)

        // Prefetch values for ALL sheets in parallel so switching tabs is instant
        async function fetchValues(sheetTitle: string) {
            const rangeTitle = `'${sheetTitle}'!A1:Z10000`
            const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeTitle)}`, {
                headers: { Authorization: `Bearer ${token.access_token}` },
            }).then(r=>r.json()).catch(()=>null)
            const values: string[][] = res?.values ?? []
            // Determine max number of columns across all rows to avoid missing cols when header row is sparse
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

        const entries = await Promise.all(
            (list as Array<{title:string}>).map(async s => [s.title, await fetchValues(s.title)] as const)
        )
        const cache: Record<string, { headers: Array<{key:string;label:string}>, rows: RowData[] }> = {}
        entries.forEach(([title, data]) => { cache[title] = data })
        setSheetCache(cache)
        setLoading(false)
        if (title && cache[title]) {
            setHeaders(cache[title].headers)
            setRows(cache[title].rows)
        }
    }

    async function loadActiveSheet(title: string) {
        const cached = sheetCache[title]
        if (cached) {
            setHeaders(cached.headers)
            setRows(cached.rows)
        }
    }

	return (
        <div className="space-y-2 h-full flex flex-col min-h-0">
					<div className="flex items-center gap-2 justify-between">
					<div className="text-sm text-muted-foreground">Test data</div>
					<div className="flex items-center gap-2">
						<Input placeholder="Paste Google Sheet URL" value={sheetUrl} onChange={(e)=>setSheetUrl(e.target.value)} className="w-[340px]" />
						<Button size="sm" variant="outline" onClick={loadSheet} disabled={loading}>{loading ? 'Loading…' : 'Load'}</Button>
						<Button size="sm" onClick={startOAuth}>Connect Google</Button>
					</div>
				</div>

                    {(sheets.length > 0 && activeSheet) && (
                        <div className="px-2">
                            <ScrollArea>
                                <div className="min-w-max">
                                    <Tabs value={activeSheet} onValueChange={(v)=>{ setActiveSheet(v); loadActiveSheet(v) }}>
                                        <TabsList className="p-0">
                                            {sheets.map(s => (
                                                <TabsTrigger key={s.id} value={s.title} className="mx-0.5">
                                                    {s.title}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                <div className="flex-1 min-h-0 relative">
                    {/* Virtualized scroll container */}
                    <div ref={parentRef} className="h-full overflow-auto">
                        <div className="inline-block min-w-max rounded-md border">
                        <Table className="w-full">
                <TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead key={h.id}>
									{h.isPlaceholder
										? null
										: flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
                <TableBody>
                    {/* Top spacer */}
                    {rowVirtualizer.getVirtualItems()[0] && (
                        <TableRow style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                            <TableCell colSpan={headers.length + 1} />
                        </TableRow>
                    )}
                    {rowVirtualizer.getVirtualItems().map((vi) => {
                        const r = table.getRowModel().rows[vi.index]
                        return (
                            <TableRow key={r.id}>
                                {r.getVisibleCells().map((c) => (
                                    <TableCell key={c.id}>
                                        {flexRender(c.column.columnDef.cell, c.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )
                    })}
                    {/* Bottom spacer */}
                    {(() => {
                        const v = rowVirtualizer.getVirtualItems()
                        const end = v.length ? v[v.length - 1].end : 0
                        const total = rowVirtualizer.getTotalSize()
                        const pad = Math.max(0, total - end)
                        return pad > 0 ? (
                            <TableRow style={{ height: pad }}>
                                <TableCell colSpan={headers.length + 1} />
                            </TableRow>
                        ) : null
                    })()}
                </TableBody>
                            </Table>
                        </div>
                    </div>
                    {/* Scroll affordance arrows overlayed relative to the wrapper, not the scrolled content */}
                    <VerticalScrollAffordance scrollRef={parentRef} />
                </div>
				
            <div className="px-2 py-1 text-sm text-muted-foreground shrink-0">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
		</div>
	)
}


