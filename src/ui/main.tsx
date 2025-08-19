import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SheetSyncWizard, RowData, ConfirmPayload } from './components/sheets/SheetSyncWizard'
import { ResizableHandle } from './components/ui/resizable'

type Step = 'select' | 'confirm'

function ConfirmScreen({ payload, onBack }: { payload: ConfirmPayload; onBack: () => void }) {
    const [layers, setLayers] = React.useState<Array<{ id: string; name: string; tag: string }>>([])
    const [fieldKeys, setFieldKeys] = React.useState<string[]>([])
    const [fieldTypes, setFieldTypes] = React.useState<Record<string, 'text' | 'image' | 'link'>>({})

    React.useEffect(() => {
        parent.postMessage({ pluginMessage: { type: 'layers/getForSelection' } }, '*')
        function onMessage(e: MessageEvent) {
            const msg = (e.data && e.data.pluginMessage) || e.data
            if (msg?.type === 'layers/eligible') {
                setLayers(msg.layers || [])
            }
        }
        window.addEventListener('message', onMessage)
        // Build merged field keys across tabs
        const merged = new Set<string>()
        const inferred: Record<string, 'text' | 'image' | 'link'> = {}
        payload.selectedTabs.forEach((t) => {
            const by = payload.byTab[t]
            if (!by) return
            by.headers?.forEach?.((h: any, idx: number) => {
                merged.add(h.key)
                const firstRow = by.rows?.[0]
                const sample = firstRow ? firstRow[h.key] : ''
                const type = inferFieldType(sample)
                if (!inferred[h.key]) inferred[h.key] = type
            })
        })
        setFieldKeys(Array.from(merged))
        setFieldTypes(inferred)
        return () => window.removeEventListener('message', onMessage)
    }, [payload])

    function inferFieldType(value: string): 'text' | 'image' | 'link' {
        const v = String(value || '').trim()
        if (!v) return 'text'
        try {
            const u = new URL(v)
            const host = u.host.toLowerCase()
            const pathname = u.pathname.toLowerCase()
            const isImageExt = /\.(png|jpe?g|gif|webp|svg)$/i.test(pathname)
            const isGDrive = host.endsWith('googleusercontent.com') || host.includes('drive.google.com')
            if (isImageExt || isGDrive) return 'image'
            return 'link'
        } catch {
            return 'text'
        }
    }

    const tagToCount = React.useMemo(() => {
        const map = new Map<string, number>()
        layers.forEach((l) => {
            map.set(l.tag, (map.get(l.tag) || 0) + 1)
        })
        return map
    }, [layers])

    const sortedTags = React.useMemo(() => Array.from(tagToCount.keys()).sort(), [tagToCount])

    return (
        <div className="h-full flex flex-col gap-3 min-h-0">
            <div className="text-sm text-muted-foreground">Match Figma layers to sheet fields</div>
            <div className="flex-1 min-h-0 rounded-md border">
                <div className="grid grid-cols-2 gap-0 text-xs">
                    <div className="px-2 py-1 border-b font-medium">Figma layers (#tag)</div>
                    <div className="px-2 py-1 border-b font-medium">Matched field</div>
                </div>
                <div className="min-h-0 max-h-full overflow-auto">
                    {sortedTags.map((tag) => {
                        const count = tagToCount.get(tag) || 0
                        const exists = fieldKeys.includes(tag)
                        return (
                            <div key={tag} className="grid grid-cols-2 items-center gap-0 py-1 px-2 border-b last:border-b-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="truncate">#{tag}</span>
                                    {count > 1 && (
                                        <span className="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    {exists ? (
                                        <>
                                            <span className="truncate text-green-600">{tag}</span>
                                            <span className="inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                {fieldTypes[tag] || 'text'}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="truncate text-orange-600">missing</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {sortedTags.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">Select a component or instance with text layers named starting with #.</div>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                <button className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm" onClick={onBack}>Back</button>
            </div>
        </div>
    )
}

function App() {
    const [step, setStep] = React.useState<Step>('select')
    const [selectedRows, setSelectedRows] = React.useState<RowData[]>([])
    const [confirmPayload, setConfirmPayload] = React.useState<ConfirmPayload | null>(null)

    return (
        <div className="h-full flex flex-col p-4 gap-3 min-h-0">
            <h2 className="text-lg font-semibold">UI Demo</h2>
            <div className="flex-1 min-h-0 relative">
                <div className={step === 'select' ? 'h-full' : 'hidden'}>
                    <SheetSyncWizard onSelectionChange={setSelectedRows} onNext={(p) => { setConfirmPayload(p); setStep('confirm') }} />
                </div>
                <div className={step === 'confirm' ? 'h-full' : 'hidden'}>
                    {confirmPayload && <ConfirmScreen payload={confirmPayload} onBack={() => setStep('select')} />}
                </div>
            </div>
            <ResizableHandle />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(<App />)


