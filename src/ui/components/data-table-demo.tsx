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
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1000`, {
            headers: { Authorization: `Bearer ${token.access_token}` },
        }).then(r=>r.json()).catch(()=>null)
        setLoading(false)
        if (!res?.values) {
            return alert('Failed to load sheet values')
        }
        const values: string[][] = res.values
        const labels = values[0]?.map(String) ?? []
        const toKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        const keys = labels.map(toKey)
        const dataRows: RowData[] = values.slice(1).map((row) => {
            const obj: RowData = {}
            keys.forEach((k, i) => { obj[k] = row[i] ?? '' })
            return obj
        })
        setHeaders(labels.map((label, i) => ({ label, key: keys[i] })))
        setRows(dataRows)
    }

	return (
			<div className="space-y-2 overflow-x-auto">
				<div className="flex items-center gap-2 justify-between">
					<div className="text-sm text-muted-foreground">Test data</div>
					<div className="flex items-center gap-2">
						<Input placeholder="Paste Google Sheet URL" value={sheetUrl} onChange={(e)=>setSheetUrl(e.target.value)} className="w-[340px]" />
						<Button size="sm" variant="outline" onClick={loadSheet} disabled={loading}>{loading ? 'Loading…' : 'Load'}</Button>
						<Button size="sm" onClick={startOAuth}>Connect Google</Button>
					</div>
				</div>
			<div className="inline-block min-w-max rounded-md border overflow-hidden">
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
					{table.getRowModel().rows.map((r) => (
						<TableRow key={r.id}>
						{r.getVisibleCells().map((c) => (
							<TableCell key={c.id}>
								{flexRender(c.column.columnDef.cell, c.getContext())}
							</TableCell>
						))}
						</TableRow>
					))}
				</TableBody>
				</Table>
			</div>
            <div className="px-2 py-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
		</div>
	)
}


