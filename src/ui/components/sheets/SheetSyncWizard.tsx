"use client"
import * as React from "react"
import { useMemo } from "react"
import {
	ColumnDef,
	getCoreRowModel,
	useReactTable,
	flexRender,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { SourceStep } from "../steps/SourceStep"
import { TabsStep } from "../steps/TabsStep"
import { AuthStep } from "../steps/AuthStep"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { ScrollArea } from "../ui/scroll-area"
import { VerticalScrollAffordance } from "../vertical-scroll-affordance"
// Virtualization
import { useVirtualizer } from "@tanstack/react-virtual"
import { Checkbox } from "../ui/checkbox"

export type RowData = Record<string, string>

type SheetSyncWizardProps = {
	onSelectionChange?: (rows: RowData[]) => void
	onNext?: (payload: ConfirmPayload) => void
}

export type ConfirmPayload = {
	selectedTabs: string[]
	byTab: Record<string, { headers: Array<{ key: string; label: string }>; rows: RowData[] }>
}

export function SheetSyncWizard(props: SheetSyncWizardProps) {
	const [tabRowSelection, setTabRowSelection] = React.useState<Record<string, Record<string, boolean>>>({})
	const lastIndexRef = React.useRef<number | null>(null)
	const shiftRef = React.useRef(false)
	const [sessionId, setSessionId] = React.useState<string | null>(null)
	const pollTimerRef = React.useRef<number | null>(null)
	const [userinfo, setUserinfo] = React.useState<{ email?: string; name?: string; picture?: string } | null>(null)
	// Helper to send debug logs to main
	const uiLog = React.useCallback((message: any, notify = false) => {
		try {
			// eslint-disable-next-line no-console
			console.debug('[UI]', message)
		} catch {}
		try {
			parent.postMessage({ pluginMessage: { type: 'log', message, notify } }, '*')
		} catch {}
	}, [])

	// On mount, check token validity (userinfo and a lightweight Google API) and decide the step
	React.useEffect(() => {
		let cancelled = false
		uiLog('mount: requesting oauth/get')
		async function run() {
			try {
				parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
				const { token, userinfo: savedUserinfo } = await new Promise<any>((resolve) => {
					function onMessage(e: MessageEvent) {
						const msg = (e.data && e.data.pluginMessage) || e.data
						if (msg?.type === 'oauth/token') {
							window.removeEventListener('message', onMessage)
							resolve({ token: msg.token, userinfo: msg.userinfo })
						}
					}
					window.addEventListener('message', onMessage)
				})
				const accessToken = token?.access_token
				if (savedUserinfo && !cancelled) setUserinfo(savedUserinfo)
				if (!accessToken) {
					if (!cancelled) setUiStep('auth')
					return
				}
				// Check token freshness via tokeninfo (doesn't require Drive/Sheets calls)
				// https://oauth2.googleapis.com/tokeninfo?access_token=
				try {
					const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
					if (resp.status !== 200) {
						uiLog({ tokeninfo: resp.status }, true)
						if (!cancelled) setUiStep('auth')
						return
					}
				} catch (err) {
					uiLog({ error: 'tokeninfo request failed', err }, true)
					if (!cancelled) setUiStep('auth')
					return
				}
				if (!cancelled) setUiStep('source')
			} catch (e) {
				uiLog({ error: 'mount oauth/get flow failed', e }, true)
				if (!cancelled) setUiStep('auth')
			}
		}
		run()
		return () => { cancelled = true }
	}, [uiLog])
	const [sheetUrl, setSheetUrl] = React.useState('')
	const [loading, setLoading] = React.useState(false)
	const [uiStep, setUiStep] = React.useState<'auth' | 'source' | 'tabs' | 'table'>('source')
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
	const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set())

	// Fetch profile if tokens exist but userinfo absent
	async function fetchGoogleUserinfo(accessToken: string): Promise<{ email?: string; name?: string; picture?: string } | null> {
		try {
			const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
				headers: { Authorization: `Bearer ${accessToken}` },
			})
			if (res.status === 401) {
				uiLog('userinfo 401 (ignoring, continue with token-only)', true)
				return null
			}
			if (!res.ok) return null
			const u = await res.json()
			return { email: u.email, name: u.name, picture: u.picture }
		} catch {
			return null
		}
	}

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

	const currentSheetKey = (activeSheet ?? '__none__') as string
	const currentRowSelection = tabRowSelection[currentSheetKey] ?? {}

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableRowSelection: true,
		onRowSelectionChange: (updater) => {
			setTabRowSelection((prev) => {
				const prevForTab = prev[currentSheetKey] ?? {}
				const nextForTab = typeof updater === 'function' ? (updater as (old: Record<string, boolean>) => Record<string, boolean>)(prevForTab) : updater
				return { ...prev, [currentSheetKey]: nextForTab }
			})
		},
		state: { rowSelection: currentRowSelection },
	})

	React.useEffect(() => {
		if (!props.onSelectionChange) return
		const selected = table.getFilteredSelectedRowModel().rows.map((r) => r.original as RowData)
		props.onSelectionChange(selected)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tabRowSelection, rows, activeSheet])

	function buildConfirmPayload(): ConfirmPayload {
		const titles = Array.from(selectedTabs)
		const byTab: Record<string, { headers: Array<{ key: string; label: string }>; rows: RowData[] }> = {}
		titles.forEach((t) => {
			const data = sheetCache[t]
			if (!data) return
			const selectionMap = tabRowSelection[t] ?? {}
			const filteredRows = data.rows.filter((_, idx) => !!selectionMap[String(idx)])
			byTab[t] = { headers: data.headers, rows: filteredRows }
		})
		return { selectedTabs: titles, byTab }
	}

	const totalSelectedCount = React.useMemo(() => {
		let count = 0
		Array.from(selectedTabs).forEach((t) => {
			const m = tabRowSelection[t]
			if (m) count += Object.keys(m).length
		})
		return count
	}, [selectedTabs, tabRowSelection])

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
		uiLog('oauth/start')
		// Clear any previous polling interval
		if (pollTimerRef.current !== null) {
			window.clearInterval(pollTimerRef.current)
			pollTimerRef.current = null
		}
		const r = await fetch('https://google-sheet-sync-api.vercel.app/api/oauth/start').then(r=>r.json())
		setSessionId(r.sessionId)
		parent.postMessage({ pluginMessage: { type: 'oauth/open', url: r.url } }, '*')
		// polling via interval to ensure cleanup works reliably
		const mySession = r.sessionId as string
		pollTimerRef.current = window.setInterval(async () => {
			try {
				const polled = await fetch(`https://google-sheet-sync-api.vercel.app/api/oauth/poll?sessionId=${mySession}`).then(r=>r.json()).catch(()=>null)
				if (polled?.done && polled?.result?.tokens) {
					uiLog({ receive: 'oauth/poll final', hasTokens: true, hasUser: !!polled.result.userinfo?.email }, true)
					parent.postMessage({ pluginMessage: { type: 'oauth/save', token: polled.result.tokens, userinfo: polled.result.userinfo } }, '*')
					if (polled.result.userinfo) setUserinfo(polled.result.userinfo)
					// Sync back from storage
					parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
					await new Promise<void>((resolve) => {
						function onMsg(e: MessageEvent) {
							const msg = (e.data && e.data.pluginMessage) || e.data
							if (msg?.type === 'oauth/token') {
								window.removeEventListener('message', onMsg)
								if (msg.userinfo) setUserinfo(msg.userinfo)
								resolve()
							}
						}
						window.addEventListener('message', onMsg)
					})
					setUiStep('source')
					if (pollTimerRef.current !== null) {
						window.clearInterval(pollTimerRef.current)
						pollTimerRef.current = null
						uiLog('oauth/poll stopped')
					}
				}
			} catch (e) {
				uiLog({ error: 'oauth/poll iteration failed', e })
			}
		}, 1000)
	}

	// Cleanup polling on unmount
	React.useEffect(() => {
		return () => {
			if (pollTimerRef.current !== null) {
				window.clearInterval(pollTimerRef.current)
				pollTimerRef.current = null
				uiLog('oauth/poll cleared on unmount')
			}
		}
	}, [uiLog])

	function parseSheetId(url: string): string | null {
		// Supports: https://docs.google.com/spreadsheets/d/<sheetId>/edit...
		const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
		return m?.[1] ?? null
	}

	async function loadSheet() {
		uiLog('loadSheet: begin')
		const sheetId = parseSheetId(sheetUrl)
		if (!sheetId) return alert('Paste a valid Google Sheet URL')
		setLoading(true)
		// ask worker for stored token
		parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
		const { token, userinfo: savedUserinfo } = await new Promise<any>((resolve) => {
			function onMessage(e: MessageEvent) {
				const msg = (e.data && e.data.pluginMessage) || e.data
				if (msg?.type === 'oauth/token') {
					window.removeEventListener('message', onMessage)
					resolve({ token: msg.token, userinfo: msg.userinfo })
				}
			}
			window.addEventListener('message', onMessage)
		})
		if (savedUserinfo) setUserinfo(savedUserinfo)
		if (!token?.access_token) {
			setLoading(false)
			uiLog('loadSheet: no token, switching to auth', true)
			setUiStep('auth')
			return
		}
		// Only fetch sheets list (metadata) for now
		const meta = await fetch(
			`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title,index))`,
			{ headers: { Authorization: `Bearer ${token.access_token}` } },
		).then(r=>r.json()).catch((e)=>{ uiLog({ error: 'meta fetch failed', e }, true); return null })
		if (meta?.error?.code === 401) {
			uiLog('meta 401 → clearing tokens and showing auth', true)
			parent.postMessage({ pluginMessage: { type: 'oauth/clear' } }, '*')
			setLoading(false)
			setUiStep('auth')
			return
		}
		const list = (meta?.sheets ?? []).map((s:any)=>({ id: s.properties.sheetId, title: s.properties.title }))
		setSheets(list)
		const firstTitle = list[0]?.title
		setActiveSheet(firstTitle ?? null)
		setSelectedTabs(new Set(firstTitle ? [firstTitle] : []))
		setLoading(false)
		uiLog({ loadSheet: 'meta-only complete', sheets: list.map((s:any)=>s.title) })
		setUiStep('tabs')
	}

	// Helper to fetch sheet values for a given sheet title using current URL/token
	async function fetchValuesFor(sheetId: string, token: string, sheetTitle: string) {
		const rangeTitle = `'${sheetTitle}'!A1:Z10000`
		const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeTitle)}`, {
			headers: { Authorization: `Bearer ${token}` },
		}).then(r=>r.json()).catch(()=>null)
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

	async function fetchSelectedTabsAndEnterTable() {
		uiLog({ fetchSelectedTabs: Array.from(selectedTabs) })
		const sheetId = parseSheetId(sheetUrl)
		if (!sheetId) return alert('Paste a valid Google Sheet URL')
		setLoading(true)
		// get token
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
			uiLog('enterTable: no token', true)
			return alert('Connect Google first')
		}
		const titles = Array.from(selectedTabs)
		const entries = await Promise.all(
			titles.map(async (t) => [t, await fetchValuesFor(sheetId, token.access_token, t)] as const)
		)
		const cache: Record<string, { headers: Array<{key:string;label:string}>, rows: RowData[] }> = {}
		entries.forEach(([title, data]) => { cache[title] = data })
		setSheetCache(cache)
		const first = titles[0]
		setActiveSheet(first ?? null)
		if (first && cache[first]) {
			setHeaders(cache[first].headers)
			setRows(cache[first].rows)
		}
		setLoading(false)
		uiLog({ enterTable: 'loaded data for tabs', tabs: titles })
		setUiStep('table')
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
					{/* Step: Auth (only if not logged in) */}
					<div className={uiStep === 'auth' ? '' : 'hidden'}>
						<AuthStep onConnect={startOAuth} />
					</div>

					{/* Step: Source (URL + Connect + Load) */}
					<div className={uiStep === 'source' ? '' : 'hidden'}>
						<SourceStep
							sheetUrl={sheetUrl}
							loading={loading}
							onChangeUrl={setSheetUrl}
							onConnect={startOAuth}
							onLoad={loadSheet}
							userinfo={userinfo ?? undefined}
							onRefreshUserinfo={async () => {
								uiLog('manual refresh userinfo')
								parent.postMessage({ pluginMessage: { type: 'oauth/get' } }, '*')
								const { token } = await new Promise<any>((resolve) => {
									function onMessage(e: MessageEvent) {
										const msg = (e.data && e.data.pluginMessage) || e.data
										if (msg?.type === 'oauth/token') {
											window.removeEventListener('message', onMessage)
											resolve({ token: msg.token })
										}
									}
									window.addEventListener('message', onMessage)
								})
								if (!token?.access_token) {
									uiLog('refresh userinfo: no token', true)
									setUiStep('auth')
									return
								}
								const u = await fetchGoogleUserinfo(token.access_token)
								if (!u) {
									uiLog('refresh userinfo failed; token may be invalid', true)
									return
								}
								setUserinfo(u)
								parent.postMessage({ pluginMessage: { type: 'oauth/save', userinfo: u } }, '*')
							}}
						/>
					</div>

					{/* Step: Tabs selection */}
					{uiStep === 'tabs' && (
						<TabsStep
							sheets={sheets}
							selectedTabs={selectedTabs}
							loading={loading}
							onBack={() => setUiStep('source')}
							onNext={fetchSelectedTabsAndEnterTable}
							onToggleTab={(title, checked) => {
								setSelectedTabs((prev) => {
									const next = new Set(prev)
									if (checked) next.add(title)
									else next.delete(title)
									return next
								})
							}}
						/>
					)}

					{/* Step: Table (only selected tabs) */}
					{(uiStep === 'table' && sheets.length > 0 && activeSheet) && (
						<div className="px-2">
							<ScrollArea>
								<div className="min-w-max">
									<div className="flex items-center justify-between mb-1">
										<Button size="sm" variant="outline" onClick={()=>setUiStep('tabs')}>Back</Button>
									</div>
									<Tabs value={activeSheet} onValueChange={(v)=>{ setActiveSheet(v); loadActiveSheet(v) }}>
										<TabsList className="p-0">
											{sheets.filter(s => selectedTabs.has(s.title)).map(s => (
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
					<div ref={parentRef} className={uiStep === 'table' ? 'h-full overflow-auto' : 'hidden'}>
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
				
			{uiStep === 'table' && (
				<div className="px-2 py-1 text-sm text-muted-foreground shrink-0 flex items-center justify-between">
					<div>
						{table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								// Build sync payload per selected tab
								const tabs = Array.from(selectedTabs)
								const sets = tabs.map((t) => {
									const data = sheetCache[t]
									const selectionMap = tabRowSelection[t] ?? {}
									const selectedRows: RowData[] = (data?.rows ?? []).filter((_, idx) => !!selectionMap[String(idx)])
									return { tabTitle: t, headers: data?.headers ?? [], rows: selectedRows }
								}).filter(s => s.rows.length > 0)
								parent.postMessage({ pluginMessage: { type: 'sync/text', payload: { sets } } }, '*')
							}}
							disabled={totalSelectedCount === 0}
						>
							Sync text
						</Button>
						<Button
							size="sm"
							onClick={() => props.onNext && props.onNext(buildConfirmPayload())}
							disabled={totalSelectedCount === 0 || !props.onNext}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}


