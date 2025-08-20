"use client"
import * as React from "react"
import { SourceStep } from "../steps/SourceStep"
import { TabsStep } from "../steps/TabsStep"
import { AuthStep } from "../steps/AuthStep"
import { parseSheetId, fetchSheetMeta, fetchValuesFor } from '@/ui/lib/sheets'
import { attachImageFetchHandler } from '@/ui/lib/image'
import { TableStep } from '../steps/TableStep/TableStep'
import type { RowData, ConfirmPayload } from '@/ui/types'
import { uiLog } from '@/ui/lib/log'
import { getStoredAuth } from '@/ui/lib/oauth'


type SheetSyncWizardProps = {
    onSelectionChange?: (rows: RowData[]) => void
    onNext?: (payload: ConfirmPayload) => void
}

export function SheetSyncWizard(props: SheetSyncWizardProps) {
	const [tabRowSelection, setTabRowSelection] = React.useState<Record<string, Record<string, boolean>>>({})
	const [sessionId, setSessionId] = React.useState<string | null>(null)
	const pollTimerRef = React.useRef<number | null>(null)
	const [userinfo, setUserinfo] = React.useState<{ email?: string; name?: string; picture?: string } | null>(null)

	// On mount, check token validity and decide the step
	React.useEffect(() => {
		let cancelled = false
		uiLog('mount: requesting oauth/get')
		async function run() {
			try {
				const { token, userinfo: savedUserinfo } = await getStoredAuth()
				const accessToken = token?.access_token
				if (savedUserinfo && !cancelled) setUserinfo(savedUserinfo)
				if (!accessToken) { if (!cancelled) setUiStep('auth'); return }
				try {
					const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
					if (resp.status !== 200) { uiLog({ tokeninfo: resp.status }, true); if (!cancelled) setUiStep('auth'); return }
				} catch (err) { uiLog({ error: 'tokeninfo request failed', err }, true); if (!cancelled) setUiStep('auth'); return }
				if (!cancelled) setUiStep('source')
			} catch (e) { uiLog({ error: 'mount oauth/get flow failed', e }, true); if (!cancelled) setUiStep('auth') }
		}
		run()
		return () => { cancelled = true }
	}, [])
	const [sheetUrl, setSheetUrl] = React.useState('')
	const [loading, setLoading] = React.useState(false)
	const [uiStep, setUiStep] = React.useState<'auth' | 'source' | 'tabs' | 'table'>('source')
	const [headers, setHeaders] = React.useState<Array<{ key: string; label: string }>>([])
	const [rows, setRows] = React.useState<RowData[]>([])
	const [sheets, setSheets] = React.useState<Array<{ id: number; title: string }>>([])
	const [activeSheet, setActiveSheet] = React.useState<string | null>(null)
	const [sheetCache, setSheetCache] = React.useState<Record<string, { headers: Array<{key:string;label:string}>, rows: RowData[] }>>({})
	const [selectedTabs, setSelectedTabs] = React.useState<Set<string>>(new Set())
	const [analyzeMode, setAnalyzeMode] = React.useState(false)
	const [tabAnalyzeSelection, setTabAnalyzeSelection] = React.useState<Record<string, Record<string, boolean>>>({})

	async function fetchGoogleUserinfo(accessToken: string): Promise<{ email?: string; name?: string; picture?: string } | null> {
		try {
			const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
			if (res.status === 401) { uiLog('userinfo 401 (ignoring, continue with token-only)', true); return null }
			if (!res.ok) return null
			const u = await res.json()
			return { email: u.email, name: u.name, picture: u.picture }
		} catch { return null }
	}

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

	// OAuth start
	async function startOAuth() {
		uiLog('oauth/start')
		if (pollTimerRef.current !== null) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null }
		const r = await fetch('https://google-sheet-sync-api.vercel.app/api/oauth/start').then(r=>r.json())
		setSessionId(r.sessionId)
		parent.postMessage({ pluginMessage: { type: 'oauth/open', url: r.url } }, '*')
		const mySession = r.sessionId as string
		pollTimerRef.current = window.setInterval(async () => {
			try {
				const polled = await fetch(`https://google-sheet-sync-api.vercel.app/api/oauth/poll?sessionId=${mySession}`).then(r=>r.json()).catch(()=>null)
				if (polled?.done && polled?.result?.tokens) {
					uiLog({ receive: 'oauth/poll final', hasTokens: true, hasUser: !!polled.result.userinfo?.email }, true)
					parent.postMessage({ pluginMessage: { type: 'oauth/save', token: polled.result.tokens, userinfo: polled.result.userinfo } }, '*')
					if (polled.result.userinfo) setUserinfo(polled.result.userinfo)
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
					if (pollTimerRef.current !== null) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; uiLog('oauth/poll stopped') }
				}
			} catch (e) { uiLog({ error: 'oauth/poll iteration failed', e }) }
		}, 1000)
	}

	React.useEffect(() => () => { if (pollTimerRef.current !== null) { window.clearInterval(pollTimerRef.current); pollTimerRef.current = null; uiLog('oauth/poll cleared on unmount') } }, [])

	async function loadSheet() {
		uiLog('loadSheet: begin')
		const sheetId = parseSheetId(sheetUrl)
		if (!sheetId) return alert('Paste a valid Google Sheet URL')
		setLoading(true)
		const { token, userinfo: savedUserinfo } = await getStoredAuth()
		if (savedUserinfo) setUserinfo(savedUserinfo)
		if (!token?.access_token) { setLoading(false); uiLog('loadSheet: no token, switching to auth', true); setUiStep('auth'); return }
		const metaList = await fetchSheetMeta(sheetId, token.access_token)
		if (!metaList) { uiLog('meta 401 → clearing tokens and showing auth', true); parent.postMessage({ pluginMessage: { type: 'oauth/clear' } }, '*'); setLoading(false); setUiStep('auth'); return }
		setSheets(metaList)
		const firstTitle = metaList[0]?.title
		setActiveSheet(firstTitle ?? null)
		setSelectedTabs(new Set(firstTitle ? [firstTitle] : []))
		setLoading(false)
		uiLog({ loadSheet: 'meta-only complete', sheets: metaList.map((s:any)=>s.title) })
		setUiStep('tabs')
	}

	async function fetchSelectedTabsAndEnterTable() {
		uiLog({ fetchSelectedTabs: Array.from(selectedTabs) })
		const sheetId = parseSheetId(sheetUrl)
		if (!sheetId) return alert('Paste a valid Google Sheet URL')
		setLoading(true)
		try {
			const { token } = await getStoredAuth()
			if (!token?.access_token) { setLoading(false); uiLog('enterTable: no token', true); alert('Connect Google first'); return }
			const titles = Array.from(selectedTabs)
			const entries = await Promise.all(titles.map(async (t) => [t, await fetchValuesFor(sheetId, token.access_token, t)] as const))
			const cache: Record<string, { headers: Array<{key:string;label:string}>, rows: RowData[] }> = {}
			entries.forEach(([title, data]) => { cache[title] = data })
			setSheetCache(cache)
			const first = titles[0]
			setActiveSheet(first ?? null)
			if (first && cache[first]) { setHeaders(cache[first].headers); setRows(cache[first].rows) }
			uiLog({ enterTable: 'loaded data for tabs', tabs: titles })
			setUiStep('table')
		} catch (e) { uiLog({ error: 'enterTable failed', e }, true) } finally { setLoading(false) }
	}

	React.useEffect(() => {
		const detach = attachImageFetchHandler(uiStep === 'table')
		return () => { try { detach() } catch {} }
	}, [uiStep])

	async function loadActiveSheet(title: string) {
		const cached = sheetCache[title]
		if (cached) { setHeaders(cached.headers); setRows(cached.rows) }
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
								if (msg?.type === 'oauth/token') { window.removeEventListener('message', onMessage); resolve({ token: msg.token }) }
							}
							window.addEventListener('message', onMessage)
						})
						if (!token?.access_token) { uiLog('refresh userinfo: no token', true); setUiStep('auth'); return }
						const u = await fetchGoogleUserinfo(token.access_token)
						if (!u) { uiLog('refresh userinfo failed; token may be invalid', true); return }
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
						setSelectedTabs((prev) => { const next = new Set(prev); if (checked) next.add(title); else next.delete(title); return next })
					}}
				/>
			)}
			{/* Step: Table (only selected tabs) */}
			{(uiStep === 'table' && sheets.length > 0 && activeSheet) && (
				<TableStep
					headers={headers}
					rows={rows}
					sheets={sheets}
					selectedTabs={selectedTabs}
					activeSheet={activeSheet}
					onBack={()=>setUiStep('tabs')}
					onChangeTab={(v)=>{ setActiveSheet(v); loadActiveSheet(v) }}
					onSelectionChange={(selected)=> props.onSelectionChange?.(selected)}
					onSync={() => {
						const tabs = Array.from(selectedTabs)
						const sets = tabs.map((t) => {
							const data = sheetCache[t]
							const selectionMap = tabRowSelection[t] ?? {}
							const selectedRows: RowData[] = (data?.rows ?? []).filter((_, idx) => !!selectionMap[String(idx)])
							return { tabTitle: t, headers: data?.headers ?? [], rows: selectedRows }
						}).filter(s => s.rows.length > 0)
						parent.postMessage({ pluginMessage: { type: 'sync/text', payload: { sets } } }, '*')
					}}
					onNext={() => props.onNext && props.onNext(buildConfirmPayload())}
					analyzeMode={analyzeMode}
					setAnalyzeMode={(v)=>setAnalyzeMode(v)}
					tabAnalyzeSelection={tabAnalyzeSelection}
					setTabAnalyzeSelection={setTabAnalyzeSelection}
					tabRowSelection={tabRowSelection}
					setTabRowSelection={setTabRowSelection}
				/>
			)}
		</div>
	)
}


